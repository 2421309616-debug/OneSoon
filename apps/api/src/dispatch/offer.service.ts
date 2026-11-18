import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { OrdersService } from '../orders/orders.service.js';

export interface OfferRow {
  id: string;
  order_id: string;
  driver_id: string;
  wave: number;
  bucket: string;
  created_at: Date;
  expires_at: Date;
}

/**
 * 推送的生命周期：查询 + 响应。
 *
 * 从调度器里拆出来，是因为这两件事和「定时跑一轮」没有关系 ——
 * 调度器负责「推给谁」，这里负责「推出去之后怎么收尾」。
 */
@Injectable()
export class OfferService {
  constructor(
    private readonly database: DatabaseService,
    private readonly orders: OrdersService,
  ) {}

  /** 司机端轮询：我手上有没有待响应的推送 */
  async pendingOffers(driverId: string): Promise<OfferRow[]> {
    const result = await this.database.query<OfferRow>(
      `SELECT id, order_id, driver_id, wave, bucket, created_at, expires_at
         FROM dispatch_offer
        WHERE driver_id = $1
          AND status = 'pending'
          AND expires_at > now()
        ORDER BY created_at DESC`,
      [driverId],
    );
    return result.rows;
  }

  /**
   * 司机响应推送：接受或拒绝。
   *
   * 接受这一路**复用 `OrdersService.accept()`**，不在这里再写一遍。
   * 原因是抢单：推送改成重叠之后，同一单可能同时挂在两三个司机手上，
   * 两条接单入口（按 offerId 接、按 orderId 接）必须走同一套行锁，
   * 否则「锁 A 入口、B 入口照进不误」，乐观锁就形同虚设。
   */
  async respond(
    driverId: string,
    offerId: string,
    accepted: boolean,
  ): Promise<{ ok: boolean; reason?: string }> {
    const offer = await this.database.query<{ order_id: string; status: string; expired: boolean }>(
      `SELECT order_id,
              status,
              expires_at <= now() AS expired
         FROM dispatch_offer
        WHERE id = $1 AND driver_id = $2`,
      [offerId, driverId],
    );
    const row = offer.rows[0];
    if (!row) return { ok: false, reason: '推送不存在' };
    if (row.status !== 'pending') return { ok: false, reason: '推送已处理' };
    if (row.expired) return { ok: false, reason: '推送已过期' };

    if (!accepted) return this.reject(driverId, offerId);

    try {
      await this.orders.accept(driverId, String(row.order_id));
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : '接单失败' };
    }
  }

  /** 拒绝：只改推送，不碰订单 —— 订单还要继续推给下一位 */
  private async reject(
    driverId: string,
    offerId: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    return this.database.transaction(async (client) => {
      const current = await client.query<{ id: string }>(
        `SELECT id FROM dispatch_offer
          WHERE id = $1 AND driver_id = $2 AND status = 'pending'
          FOR UPDATE`,
        [offerId, driverId],
      );
      if (!current.rows[0]) return { ok: false, reason: '推送已处理' };

      await client.query(
        `UPDATE dispatch_offer
            SET status = 'rejected', responded_at = now()
          WHERE id = $1`,
        [offerId],
      );
      return { ok: true };
    });
  }
}
