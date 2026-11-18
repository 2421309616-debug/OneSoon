import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { requirePassengerId } from '../passengers/passengers.service.js';
import { DEFAULT_TUNING } from '@onesoon/dispatch';

export const FARE_CENTS = 1000;

/**
 * 一个司机最多同时持有几单。
 *
 * 直接读派单算法里的 `maxActiveOrders`，保证「算法不再推给他」和
 * 「接口不再让他接」是同一个数字 —— 两边各写一份迟早会对不上。
 */
const MAX_ACTIVE_ORDERS = DEFAULT_TUNING.maxActiveOrders;

type Place = {
  name: string;
  longitude: number;
  latitude: number;
};

export type AssignedDriver = {
  name: string | null;
  vehicleModel: string | null;
  plate: string | null;
  photoUrl: string | null;
  vehicleImageUrl: string | null;
};

export type TripOrder = {
  id: string;
  status: 'waiting' | 'accepted' | 'cancelled';
  passengerName: string;
  pickup: Place;
  destination: Place;
  distanceMeters: number;
  durationSeconds: number;
  fareCents: number;
  createdAt: string;
  scheduledAt: string | null;
  riderName: string | null;
  riderPhone: string | null;
  preferences: RidePreferences;
  driver: AssignedDriver | null;
};

export type RidePreferences = {
  quietRide?: boolean;
  smokeFree?: boolean;
  trunkNeeded?: boolean;
  note?: string;
};

type TripOrderRow = {
  id: string;
  status: 'waiting' | 'accepted' | 'cancelled';
  passenger_name: string;
  pickup_name: string;
  pickup_longitude: number;
  pickup_latitude: number;
  destination_name: string;
  destination_longitude: number;
  destination_latitude: number;
  distance_meters: number;
  duration_seconds: number;
  fare_cents: number;
  created_at: Date;
  scheduled_at: Date | null;
  rider_name: string | null;
  rider_phone: string | null;
  preferences: RidePreferences;
  driver_id: string | null;
  driver_name: string | null;
  driver_vehicle_model: string | null;
  driver_plate: string | null;
  driver_photo: string | null;
  vehicle_option_id: number | null;
  vehicle_image_file: string | null;
};

const ORDER_FROM = `FROM trip_order o
  JOIN passenger p ON p.id = o.passenger_id
  LEFT JOIN driver d ON d.id = o.driver_id
  LEFT JOIN LATERAL (
    SELECT id, image_file
    FROM vehicle_option
    WHERE category = d.vehicle_model
    ORDER BY id
    LIMIT 1
  ) vehicle_option ON true`;

const ORDER_SELECT = `SELECT o.id, o.status, p.nickname AS passenger_name,
  o.pickup_name, o.pickup_longitude, o.pickup_latitude,
  o.destination_name, o.destination_longitude, o.destination_latitude,
  o.distance_meters, o.duration_seconds, o.fare_cents, o.created_at,
  o.scheduled_at, o.rider_name, o.rider_phone, o.preferences,
  d.id AS driver_id, d.name AS driver_name, d.vehicle_model AS driver_vehicle_model,
  d.plate AS driver_plate, d.photo AS driver_photo,
  vehicle_option.id AS vehicle_option_id, vehicle_option.image_file AS vehicle_image_file
  ${ORDER_FROM}`;

@Injectable()
export class OrdersService {
  constructor(private readonly database: DatabaseService) {}

  async create(passengerId: string, body: unknown): Promise<TripOrder> {
    const id = requirePassengerId(passengerId);
    const trip = requireTrip(body);
    await this.requirePassenger(id);

    const existing = trip.isReservation ? null : await this.findActive(id);
    if (existing) return existing;

    try {
      const inserted = await this.database.query<{ id: string }>(
        `INSERT INTO trip_order
           (passenger_id, pickup_name, pickup_longitude, pickup_latitude,
            destination_name, destination_longitude, destination_latitude,
            distance_meters, duration_seconds, fare_cents,
            scheduled_at, is_reservation, rider_name, rider_phone, preferences)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING id`,
        [
          id,
          trip.pickup.name,
          trip.pickup.longitude,
          trip.pickup.latitude,
          trip.destination.name,
          trip.destination.longitude,
          trip.destination.latitude,
          trip.distanceMeters,
          trip.durationSeconds,
          FARE_CENTS,
          trip.scheduledAt,
          trip.isReservation,
          trip.riderName,
          trip.riderPhone,
          JSON.stringify(trip.preferences),
        ],
      );
      const created = inserted.rows[0];
      if (!created) {
        throw new Error('Trip order was not created');
      }
      return this.requireOrder(created.id);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.findActive(id);
      if (!winner) throw error;
      return winner;
    }
  }

  async current(passengerId: string): Promise<{ order: TripOrder | null }> {
    const id = requirePassengerId(passengerId);
    await this.requirePassenger(id);
    return { order: await this.findActive(id) };
  }

  async allForPassenger(passengerId: string): Promise<{ orders: TripOrder[] }> {
    const id = requirePassengerId(passengerId);
    await this.requirePassenger(id);
    const result = await this.database.query<TripOrderRow>(
      `${ORDER_SELECT}
       WHERE o.passenger_id = $1
       ORDER BY o.created_at DESC, o.id DESC`,
      [id],
    );
    return { orders: result.rows.map(toOrder) };
  }

  async upcomingForPassenger(passengerId: string): Promise<{ orders: TripOrder[] }> {
    const id = requirePassengerId(passengerId);
    await this.requirePassenger(id);
    const result = await this.database.query<TripOrderRow>(
      `${ORDER_SELECT}
       WHERE o.passenger_id = $1 AND o.is_reservation = true
         AND o.scheduled_at > now() AND o.status = 'waiting'
       ORDER BY o.scheduled_at ASC, o.id ASC`,
      [id],
    );
    return { orders: result.rows.map(toOrder) };
  }

  /**
   * 司机端列表：**只返回推给这个司机的订单**。
   *
   * 这是派单模式和抢单模式的核心区别 —— 抢单是所有司机看同一个池子、谁快谁得；
   * 派单是每个司机只看自己的推送，一个订单同一时刻只在一个司机手上。
   *
   * 页面还是那个列表，变的是「列表里有什么」。
   */
  async waitingForDriver(driverId: string): Promise<{ orders: TripOrder[] }> {
    await this.requireDriver(driverId);
    const result = await this.database.query<TripOrderRow>(
      `${ORDER_SELECT}
       JOIN dispatch_offer dsp ON dsp.order_id = o.id
       WHERE dsp.driver_id = $1
         AND dsp.status = 'pending'
         AND dsp.expires_at > now()
         AND o.status = 'waiting'
         AND (o.is_reservation = false OR o.scheduled_at <= now())
       ORDER BY dsp.created_at ASC, o.id ASC`,
      [driverId],
    );
    return { orders: result.rows.map(toOrder) };
  }

  /**
   * 司机放弃订单：订单回到等待池，继续派给其他司机。
   *
   * 和乘客取消不同 —— 乘客取消是订单直接作废，司机放弃只是「换个人接」。
   * 订单是乘客的，不是司机的；司机不接，乘客还在等，应该继续找下一个。
   */
  async cancelByDriver(driverId: string, orderId: string): Promise<TripOrder> {
    await this.requireDriver(driverId);
    if (!/^[0-9]{1,18}$/.test(orderId)) {
      throw new NotFoundException('订单不存在');
    }

    const result = await this.database.query<{ id: string }>(
      `UPDATE trip_order
          SET status = 'waiting', driver_id = NULL, accepted_at = NULL
        WHERE id = $1 AND driver_id = $2 AND status = 'accepted'
        RETURNING id`,
      [orderId, driverId],
    );

    if (!result.rows[0]) {
      throw new BadRequestException('订单无法取消');
    }

    // 这一单的所有推送作废，让调度器重新从第一档开始找。
    //
    // 除了 pending，还要把这条 accepted 一起作废 —— 订单已经回到 waiting，
    // 推送却停在 accepted 就自相矛盾了（`dispatch_offer_responded_matches`
    // 要求 expired 的 responded_at 必须为空，所以一并清掉）。
    //
    // 作废不等于「没推过」：`offeredDriverIds` 查的是这张表的全部记录，
    // 所以放弃的司机不会被重新推同一单。
    await this.database.query(
      `UPDATE dispatch_offer
          SET status = 'expired', responded_at = NULL
        WHERE order_id = $1 AND status IN ('pending', 'accepted')`,
      [orderId],
    );

    return this.requireOrder(orderId);
  }

  async currentForDriver(driverId: string): Promise<{ order: TripOrder | null }> {
    await this.requireDriver(driverId);
    const result = await this.database.query<TripOrderRow>(
      `${ORDER_SELECT}
       WHERE o.driver_id = $1 AND o.status = 'accepted'`,
      [driverId],
    );
    const row = result.rows[0];
    return { order: row ? toOrder(row) : null };
  }

  /**
   * 司机手上所有进行中的订单（最多 3 单）。
   *
   * 派单策略允许多单并行：司机可以同时接着几笔订单，按自己的节奏跑。
   * `currentForDriver` 只返回最早那笔，给只关心「当前这一单」的旧调用方用。
   */
  async activeForDriver(driverId: string): Promise<{ orders: TripOrder[] }> {
    await this.requireDriver(driverId);
    const result = await this.database.query<TripOrderRow>(
      `${ORDER_SELECT}
       WHERE o.driver_id = $1 AND o.status = 'accepted'
       ORDER BY o.accepted_at ASC NULLS LAST, o.id ASC`,
      [driverId],
    );
    return { orders: result.rows.map(toOrder) };
  }

  /**
   * 司机接单。
   *
   * 派单改成「重叠推送」之后（推送 60 秒有效、每 30 秒再推下一位），
   * 同一时刻可能有两三个司机都看得到同一单——谁先点谁得，这就是抢单。
   * 所以这里必须是**事务 + 乐观锁**：
   *
   * 1. `SELECT ... FOR UPDATE` 锁住订单行 —— 同一订单的并发请求在这里排队
   * 2. 后到的人看到 `status` 已经不是 `waiting`，直接抛「已被接走」
   * 3. `UPDATE ... WHERE status = 'waiting'` 是第二道保险（乐观锁）
   * 4. 推送状态的更新和订单更新在同一个事务里，不会出现「订单接了、别人那边还挂着 pending」
   */
  async accept(driverId: string, orderId: string): Promise<TripOrder> {
    await this.requireDriver(driverId);
    if (!/^[0-9]{1,18}$/.test(orderId)) {
      throw new NotFoundException('订单不存在');
    }

    await this.database.transaction(async (client) => {
      // 1. 锁订单行，并发接单在此串行化
      const locked = await client.query<{ status: string; driver_id: string | null }>(
        `SELECT status, driver_id FROM trip_order WHERE id = $1 FOR UPDATE`,
        [orderId],
      );
      const order = locked.rows[0];
      if (!order) throw new NotFoundException('订单不存在');

      // 幂等：自己已经接过这一单，直接当成功
      if (order.status === 'accepted' && order.driver_id === driverId) return;
      if (order.status === 'accepted') throw new ConflictException('订单已被其他司机接走');
      if (order.status === 'cancelled') throw new BadRequestException('订单已取消');

      // 2. 必须持有一条有效推送 —— 不能绕过列表按单号硬接
      const offer = await client.query<{ id: string }>(
        `SELECT id FROM dispatch_offer
          WHERE order_id = $1 AND driver_id = $2
            AND status = 'pending' AND expires_at > now()
          FOR UPDATE`,
        [orderId, driverId],
      );
      if (!offer.rows[0]) {
        throw new ConflictException('这条推送已失效，请刷新列表');
      }

      // 3. 手上不能超过 3 单
      const held = await client.query<{ count: string }>(
        `SELECT count(*) AS count FROM trip_order
          WHERE driver_id = $1 AND status = 'accepted'`,
        [driverId],
      );
      if (Number(held.rows[0]?.count ?? 0) >= MAX_ACTIVE_ORDERS) {
        throw new BadRequestException(`最多同时持有 ${MAX_ACTIVE_ORDERS} 单`);
      }

      // 4. 乐观锁：只有仍是 waiting 才更新得动
      const updated = await client.query<{ id: string }>(
        `UPDATE trip_order
            SET status = 'accepted', driver_id = $2, accepted_at = now()
          WHERE id = $1 AND status = 'waiting'
          RETURNING id`,
        [orderId, driverId],
      );
      if (!updated.rows[0]) throw new ConflictException('订单已被其他司机接走');

      // 5. 自己的推送置 accepted，同一单其他人手上的推送立刻作废
      await client.query(
        `UPDATE dispatch_offer
            SET status = 'accepted', responded_at = now()
          WHERE order_id = $1 AND driver_id = $2`,
        [orderId, driverId],
      );
      await client.query(
        `UPDATE dispatch_offer
            SET status = 'expired', responded_at = NULL
          WHERE order_id = $1 AND driver_id <> $2 AND status = 'pending'`,
        [orderId, driverId],
      );
    });

    return this.requireOrder(orderId);
  }

  async cancel(passengerId: string, orderId: string): Promise<TripOrder> {
    const id = requirePassengerId(passengerId);
    if (!/^[0-9]{1,18}$/.test(orderId)) {
      throw new NotFoundException('订单不存在');
    }
    const result = await this.database.query<{ id: string }>(
      `UPDATE trip_order
       SET status = 'cancelled',
           cancelled_at = COALESCE(cancelled_at, now()),
           driver_id = NULL,
           accepted_at = NULL
       WHERE id = $1 AND passenger_id = $2 AND status IN ('waiting', 'accepted')
       RETURNING id`,
      [orderId, id],
    );
    if (result.rows[0]) {
      // 订单没了，这一单的所有推送立刻作废 —— 否则司机端还会挂 60 秒，
      // 点「接单」会撞上「订单已取消」，白白打扰一次。
      // pending 和 accepted 都要作废：后者是接单的那位，订单已经取消，
      // 他的推送停着 accepted 就自相矛盾了。
      await this.database.query(
        `UPDATE dispatch_offer
            SET status = 'expired', responded_at = NULL
          WHERE order_id = $1 AND status IN ('pending', 'accepted')`,
        [orderId],
      );
      return this.requireOrder(orderId);
    }
    throw new NotFoundException('订单不存在');
  }

  private async findActive(passengerId: string): Promise<TripOrder | null> {
    const result = await this.database.query<TripOrderRow>(
      `${ORDER_SELECT}
       WHERE o.passenger_id = $1 AND o.status IN ('waiting', 'accepted')
         AND (o.is_reservation = false OR o.scheduled_at <= now())`,
      [passengerId],
    );
    const row = result.rows[0];
    return row ? toOrder(row) : null;
  }

  private async requireOrder(id: string): Promise<TripOrder> {
    const result = await this.database.query<TripOrderRow>(
      `${ORDER_SELECT} WHERE o.id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('订单不存在');
    return toOrder(row);
  }

  private async requireDriver(id: string): Promise<void> {
    if (!/^[0-9]{5}$/.test(id)) throw new NotFoundException('司机不存在');
    const result = await this.database.query(`SELECT id FROM driver WHERE id = $1`, [id]);
    if (!result.rows[0]) throw new NotFoundException('司机不存在');
  }

  private async requirePassenger(id: string): Promise<void> {
    const result = await this.database.query(
      `SELECT id FROM passenger WHERE id = $1`,
      [id],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('乘客不存在');
    }
  }
}

function toOrder(row: TripOrderRow): TripOrder {
  return {
    id: row.id,
    status: row.status,
    passengerName: row.rider_name?.trim() || row.passenger_name,
    pickup: {
      name: row.pickup_name,
      longitude: row.pickup_longitude,
      latitude: row.pickup_latitude,
    },
    destination: {
      name: row.destination_name,
      longitude: row.destination_longitude,
      latitude: row.destination_latitude,
    },
    distanceMeters: row.distance_meters,
    durationSeconds: row.duration_seconds,
    fareCents: row.fare_cents,
    createdAt: row.created_at.toISOString(),
    scheduledAt: row.scheduled_at?.toISOString() ?? null,
    riderName: row.rider_name,
    riderPhone: row.rider_phone,
    preferences: row.preferences ?? {},
    driver: row.status === 'accepted'
      ? {
          name: row.driver_name,
          vehicleModel: row.driver_vehicle_model,
          plate: row.driver_plate,
          photoUrl: row.driver_photo && row.driver_id
            ? `/drivers/${row.driver_id}/photo?v=${encodeURIComponent(row.driver_photo)}`
            : null,
          vehicleImageUrl: row.vehicle_option_id && row.vehicle_image_file
            ? `/vehicle-options/${row.vehicle_option_id}/image?v=${encodeURIComponent(row.vehicle_image_file)}`
            : null,
        }
      : null,
  };
}

function requireTrip(body: unknown): {
  pickup: Place;
  destination: Place;
  distanceMeters: number;
  durationSeconds: number;
  scheduledAt: Date | null;
  isReservation: boolean;
  riderName: string | null;
  riderPhone: string | null;
  preferences: RidePreferences;
} {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('请提供上车点和目的地');
  }
  const value = body as Record<string, unknown>;
  const pickup = requireTripPlace(value.pickup, '上车点');
  const destination = requireTripPlace(value.destination, '目的地');
  if (!isWholeNumber(value.distanceMeters, 1, 500_000)) {
    throw new BadRequestException('路线距离不正确');
  }
  if (!isWholeNumber(value.durationSeconds, 1, 86_400)) {
    throw new BadRequestException('路线时长不正确');
  }
  const scheduledAt = optionalScheduledAt(value.scheduledAt);
  const riderName = optionalText(value.riderName, 60, '乘车人姓名');
  const riderPhone = optionalText(value.riderPhone, 20, '乘车人手机号');
  if ((riderName && !riderPhone) || (!riderName && riderPhone)) {
    throw new BadRequestException('请同时填写乘车人姓名和手机号');
  }
  if (riderPhone && !/^[+\d\-\s]{6,20}$/.test(riderPhone)) {
    throw new BadRequestException('乘车人手机号格式不正确');
  }
  const preferences = requirePreferences(value.preferences);
  return {
    pickup,
    destination,
    distanceMeters: value.distanceMeters,
    durationSeconds: value.durationSeconds,
    scheduledAt,
    isReservation: scheduledAt !== null,
    riderName,
    riderPhone,
    preferences,
  };
}

function optionalScheduledAt(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new BadRequestException('预约时间格式不正确');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() < Date.now() + 10 * 60_000) {
    throw new BadRequestException('预约时间至少需要提前 10 分钟');
  }
  return date;
}

function optionalText(value: unknown, maxLength: number, label: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new BadRequestException(`${label}格式不正确`);
  }
  return value.trim();
}

function requirePreferences(value: unknown): RidePreferences {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('乘车偏好格式不正确');
  }
  const input = value as Record<string, unknown>;
  const note = optionalText(input.note, 100, '备注');
  for (const key of ['quietRide', 'smokeFree', 'trunkNeeded']) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') {
      throw new BadRequestException('乘车偏好格式不正确');
    }
  }
  return {
    quietRide: input.quietRide === true,
    smokeFree: input.smokeFree === true,
    trunkNeeded: input.trunkNeeded === true,
    ...(note ? { note } : {}),
  };
}

function requireTripPlace(value: unknown, label: string): Place {
  if (typeof value !== 'object' || value === null) {
    throw new BadRequestException(`请提供${label}`);
  }
  const place = value as Record<string, unknown>;
  const name = typeof place.name === 'string' ? place.name.trim() : '';
  if (!name || name.length > 120) {
    throw new BadRequestException(`请提供${label}名称`);
  }
  if (
    !isCoordinate(place.longitude, -180, 180) ||
    !isCoordinate(place.latitude, -90, 90)
  ) {
    throw new BadRequestException(`${label}坐标不正确`);
  }
  return { name, longitude: place.longitude, latitude: place.latitude };
}

function isCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isWholeNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}
