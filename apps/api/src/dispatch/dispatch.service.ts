import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  DEFAULT_TUNING,
  dispatch as runDispatch,
  etaMinutes as etaMinutesBetween,
  type DispatchOrder,
  type DriverCandidate,
} from '@onesoon/dispatch';
import { DatabaseService } from '../database/database.service.js';

/** 调度器多久跑一次。每轮检查一次「有没有该推的单」 */
const TICK_MS = 15_000;

/** 一次推送的有效期。司机在这段时间内没响应就算超时，本单不再推他 */
const OFFER_TTL_MS = 60_000;

/**
 * 距上一次推送满多久，才推给下一位司机。
 *
 * 比 `OFFER_TTL_MS` 短，所以存在一段**重叠窗口**：30 秒时推给第二位司机，
 * 第一位还剩 30 秒有效期 —— 同一单在同一时刻会出现在两个人的列表里。
 * 这是有意的：宁可让两位司机都有机会，也不让乘客干等第一位回心转意。
 * 代价是可能「抢单」，由 `OrdersService.accept()` 的事务 + 行锁兜住。
 */
const REPUSH_AFTER_MS = 30_000;

/** 位置超过这个时长视为失联，不参与派单 */
const LOCATION_TTL_MS = 60_000;

interface WaitingOrderRow {
  id: string;
  pickup_longitude: number;
  pickup_latitude: number;
  destination_longitude: number;
  destination_latitude: number;
  created_at: Date;
}

interface DriverRow {
  id: string;
  longitude: number | null;
  latitude: number | null;
  location_updated_at: Date | null;
  service_score: string;
  active_order_count: string;
  today_order_count: string;
}

/**
 * 派单调度器。
 *
 * 算法本身在 `@onesoon/dispatch`（纯函数，可单测）；这里只负责：
 * 1. 定时触发
 * 2. 从数据库读候选（订单 + 在线司机）
 * 3. 算 ETA 表（将来换成高德真实路面距离，只改这一步）
 * 4. 调算法
 * 5. 把结果写进 `dispatch_offer`
 *
 * 之所以拆成两层：算法要能脱离数据库单测，调度器要能脱离算法替换策略。
 */
@Injectable()
export class DispatchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DispatchService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly database: DatabaseService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_MS);
    this.logger.log(`派单调度器已启动，每 ${TICK_MS / 1000} 秒跑一轮`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** 跑一轮：所有待派单的订单各推一次 */
  async tick(): Promise<void> {
    try {
      await this.expireStaleOffers();

      const orders = await this.waitingOrders();
      if (orders.length === 0) return;

      const drivers = await this.onlineDrivers();
      if (drivers.length === 0) return;

      for (const order of orders) {
        await this.dispatchOrder(order, drivers);
      }
    } catch (error) {
      // 调度器不能因为一次异常就死掉
      this.logger.error(`派单轮次失败: ${(error as Error).message}`);
    }
  }

  // ── 内部 ──────────────────────────────────────────────

  private async dispatchOrder(order: WaitingOrderRow, drivers: DriverRow[]): Promise<void> {
    // 1. 距上一次推送不满 30 秒 → 先等等，让那位司机多看一会儿
    //    满 30 秒就推下一位，此时上一位还剩 30 秒有效期（重叠推送，见 REPUSH_AFTER_MS）
    if (await this.pushedRecently(order.id)) return;

    // 2. 这一单推过谁
    const offered = await this.offeredDriverIds(order.id);

    // 3. 转成算法输入
    const pickup: [number, number] = [order.pickup_longitude, order.pickup_latitude];

    const dispatchOrder: DispatchOrder = {
      id: order.id,
      pickup,
      destination: [order.destination_longitude, order.destination_latitude],
      offeredDriverIds: [...offered],
    };

    const candidates: DriverCandidate[] = drivers
      .filter((driver) => driver.longitude !== null && driver.latitude !== null)
      .map((driver) => ({
        id: driver.id,
        location: [driver.longitude!, driver.latitude!],
        locationUpdatedAt: driver.location_updated_at?.getTime() ?? 0,
        serviceScore: Number(driver.service_score),
        activeOrderCount: Number(driver.active_order_count),
        todayOrderCount: Number(driver.today_order_count),
      }));

    // 4. 算 ETA 表 —— 将来换成高德真实路面距离，只改这一段
    const etaMinutes = new Map<string, number>();
    for (const candidate of candidates) {
      etaMinutes.set(
        candidate.id,
        etaMinutesBetween(
          candidate.location,
          pickup,
          DEFAULT_TUNING.detourFactor,
          DEFAULT_TUNING.averageSpeedKmh,
        ),
      );
    }

    // 5. 调算法
    const result = runDispatch({
      order: dispatchOrder,
      candidates,
      etaMinutes,
      now: Date.now(),
    });

    if (!result.ok) {
      this.logger.debug(`订单 ${order.id} 无候选（${result.reason}）`);
      return;
    }

    // 6. 写 1 条推送。wave 字段记「第几次推送」（1 起），用于运营排查
    const pushSequence = offered.size + 1;

    await this.database.query(
      `INSERT INTO dispatch_offer (order_id, driver_id, wave, bucket, expires_at)
       VALUES ($1, $2, $3, $4, now() + $5::interval)
       ON CONFLICT (order_id, driver_id) DO NOTHING`,
      [order.id, result.picked.id, pushSequence, result.bucket, `${OFFER_TTL_MS} milliseconds`],
    );

    this.logger.log(
      `订单 ${order.id} 第 ${pushSequence} 次推送 → 司机 ${result.picked.id}（${result.bucket} 档，` +
        `合格 ${result.qualifiedCount} 人）`,
    );
  }

  private async waitingOrders(): Promise<WaitingOrderRow[]> {
    const result = await this.database.query<WaitingOrderRow>(
      `SELECT id, pickup_longitude, pickup_latitude,
              destination_longitude, destination_latitude, created_at
         FROM trip_order
        WHERE status = 'waiting'
          AND (is_reservation = false OR scheduled_at <= now())
        ORDER BY created_at ASC
        LIMIT 50`,
    );
    return result.rows;
  }

  private async onlineDrivers(): Promise<DriverRow[]> {
    const result = await this.database.query<DriverRow>(
      `SELECT d.id, d.longitude, d.latitude, d.location_updated_at, d.service_score,
              (SELECT count(*) FROM trip_order t
                WHERE t.driver_id = d.id AND t.status = 'accepted') AS active_order_count,
              (SELECT count(*) FROM trip_order t
                WHERE t.driver_id = d.id
                  AND t.accepted_at::date = current_date) AS today_order_count
         FROM driver d
        WHERE d.status = 'online'
          AND d.longitude IS NOT NULL
          AND d.latitude IS NOT NULL
          AND d.location_updated_at > now() - $1::interval`,
      [`${LOCATION_TTL_MS} milliseconds`],
    );
    return result.rows;
  }

  /**
   * 最近 30 秒内推过吗？
   *
   * 不判断「有没有 pending」—— 因为推送 60 秒有效、30 秒就换人，
   * 只要还按「有 pending 就不推」，重叠窗口就永远不会打开。
   * 这里只看**时间**：距最近一次推送不满 `REPUSH_AFTER_MS` 就再等等。
   *
   * 但只有 `pending` 的推送才算数 —— 它代表「这一轮推出去、还没人回应」。
   * 已经结束的推送不拦路：
   * - `rejected`：司机已经明确说不接，没必要再干等 30 秒，下一轮直接换人；
   * - `expired`：司机放弃/乘客取消后我们主动作废的，这一轮推单已经结束，立刻重开。
   */
  private async pushedRecently(orderId: string): Promise<boolean> {
    const result = await this.database.query<{ id: string }>(
      `SELECT id FROM dispatch_offer
        WHERE order_id = $1
          AND created_at > now() - $2::interval
          AND status = 'pending'
        LIMIT 1`,
      [orderId, `${REPUSH_AFTER_MS} milliseconds`],
    );
    return result.rows.length > 0;
  }

  private async offeredDriverIds(orderId: string): Promise<Set<string>> {
    const result = await this.database.query<{ driver_id: string }>(
      `SELECT driver_id FROM dispatch_offer WHERE order_id = $1`,
      [orderId],
    );
    return new Set(result.rows.map((row) => row.driver_id));
  }

  private async expireStaleOffers(): Promise<void> {
    await this.database.query(
      `UPDATE dispatch_offer
          SET status = 'expired'
        WHERE status = 'pending' AND expires_at <= now()`,
    );
  }
}
