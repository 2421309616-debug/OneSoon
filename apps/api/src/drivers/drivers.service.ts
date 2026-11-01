import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { VerificationCodesService } from '../passengers/verification-codes.service.js';
import { requireCode, requirePhone } from '../passengers/passengers.service.js';
import { buildSeedOrders } from './driver-seed.js';

export type DriverStatus = 'online' | 'offline';

export type OrderStatus =
  | 'pool'
  | 'toPickup'
  | 'waiting'
  | 'inTrip'
  | 'settling'
  | 'completed'
  | 'cancelled';

export type DriverRecord = {
  id: string;
  phone: string;
  name: string;
  plate: string;
  carModel: string;
  rating: number;
  status: DriverStatus;
};

export type PlaceRecord = {
  name: string;
  address: string;
  longitude: number;
  latitude: number;
};

export type OrderRecord = {
  id: string;
  status: OrderStatus;
  passengerName: string;
  passengerPhone: string;
  passengerRating: number | null;
  from: PlaceRecord;
  to: PlaceRecord;
  pickupKm: number;
  pickupMinutes: number;
  tripKm: number;
  tripMinutes: number;
  fare: number;
  note: string;
  acceptedAt: string | null;
  completedAt: string | null;
};

export type DriverStats = {
  orders: number;
  income: number;
};

const POOL_TARGET = 50;
const MAX_ACTIVE_ORDERS = 3;

/** 从接单到结算的阶段顺序 */
const STAGE_ORDER: readonly OrderStatus[] = [
  'toPickup',
  'waiting',
  'inTrip',
  'settling',
  'completed',
];

const ACTIVE_STATUSES: readonly OrderStatus[] = [
  'toPickup',
  'waiting',
  'inTrip',
  'settling',
];

type DriverRow = {
  id: string;
  phone: string;
  name: string;
  plate: string;
  car_model: string;
  rating: string;
  status: string;
};

type OrderRow = {
  id: string;
  status: string;
  passenger_name: string;
  passenger_phone: string;
  passenger_rating: string | null;
  from_name: string;
  from_address: string;
  from_longitude: number;
  from_latitude: number;
  to_name: string;
  to_address: string;
  to_longitude: number;
  to_latitude: number;
  pickup_km: string;
  pickup_minutes: number;
  trip_km: string;
  trip_minutes: number;
  fare: string;
  note: string;
  accepted_at: Date | null;
  completed_at: Date | null;
};

const DRIVER_COLUMNS = `
  id, phone, name, plate, car_model, rating, status
`;

@Injectable()
export class DriversService implements OnModuleInit {
  private readonly logger = new Logger(DriversService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly codes: VerificationCodesService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedPool();
  }

  async enter(phone: string, code: string): Promise<DriverRecord> {
    this.codes.verify(phone, code);
    return this.findOrCreate(phone);
  }

  async findById(id: string): Promise<DriverRecord> {
    const driverId = requireDriverId(id);
    return this.requireDriver(driverId);
  }

  async setStatus(id: string, status: DriverStatus): Promise<DriverRecord> {
    const driverId = requireDriverId(id);
    const result = await this.database.query<DriverRow>(
      `UPDATE driver SET status = $1 WHERE id = $2 RETURNING ${DRIVER_COLUMNS}`,
      [status, driverId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('司机不存在');
    }
    return toDriverRecord(row);
  }

  async listOrders(
    id: string,
  ): Promise<{ active: OrderRecord[]; completed: OrderRecord[] }> {
    const driverId = requireDriverId(id);
    await this.requireDriver(driverId);

    const active = await this.database.query<OrderRow>(
      `SELECT * FROM driver_order
       WHERE driver_id = $1 AND status = ANY($2::text[])
       ORDER BY accepted_at ASC`,
      [driverId, ACTIVE_STATUSES],
    );
    const completed = await this.database.query<OrderRow>(
      `SELECT * FROM driver_order
       WHERE driver_id = $1 AND status = 'completed'
       ORDER BY completed_at DESC
       LIMIT 50`,
      [driverId],
    );

    return {
      active: active.rows.map(toOrderRecord),
      completed: completed.rows.map(toOrderRecord),
    };
  }

  async stats(id: string): Promise<DriverStats> {
    const driverId = requireDriverId(id);
    await this.requireDriver(driverId);
    const result = await this.database.query<{ orders: number; income: number }>(
      `SELECT count(*)::int AS orders,
              coalesce(sum(fare), 0)::float AS income
       FROM driver_order
       WHERE driver_id = $1
         AND status = 'completed'
         AND completed_at::date = current_date`,
      [driverId],
    );
    const row = result.rows[0];
    return {
      orders: Number(row?.orders ?? 0),
      income: Number(row?.income ?? 0),
    };
  }

  async pool(): Promise<{ orders: OrderRecord[] }> {
    const result = await this.database.query<OrderRow>(
      `SELECT * FROM driver_order
       WHERE status = 'pool'
       ORDER BY created_at DESC
       LIMIT 20`,
    );
    return { orders: result.rows.map(toOrderRecord) };
  }

  async accept(driverId: string, orderId: string): Promise<OrderRecord> {
    const id = requireDriverId(driverId);
    await this.requireDriver(id);
    const orderKey = requireOrderId(orderId);

    const activeCount = await this.database.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM driver_order
       WHERE driver_id = $1 AND status = ANY($2::text[])`,
      [id, ACTIVE_STATUSES],
    );
    if ((activeCount.rows[0]?.count ?? 0) >= MAX_ACTIVE_ORDERS) {
      throw new BadRequestException(`最多同时持有 ${MAX_ACTIVE_ORDERS} 单`);
    }

    const result = await this.database.query<OrderRow>(
      `UPDATE driver_order
       SET driver_id = $1, status = 'toPickup', accepted_at = now(), expires_at = NULL
       WHERE id = $2 AND status = 'pool' AND driver_id IS NULL
       RETURNING *`,
      [id, orderKey],
    );
    const row = result.rows[0];
    if (!row) {
      throw new BadRequestException('该订单已被接走或已失效');
    }
    return toOrderRecord(row);
  }

  async advance(driverId: string, orderId: string): Promise<OrderRecord> {
    const id = requireDriverId(driverId);
    const orderKey = requireOrderId(orderId);

    const current = await this.database.query<OrderRow>(
      `SELECT id, status FROM driver_order WHERE id = $1 AND driver_id = $2`,
      [orderKey, id],
    );
    const row = current.rows[0];
    if (!row) {
      throw new NotFoundException('订单不存在');
    }

    const index = STAGE_ORDER.indexOf(row.status as OrderStatus);
    if (index < 0 || index >= STAGE_ORDER.length - 1) {
      throw new BadRequestException('订单已结束');
    }
    const next = STAGE_ORDER[index + 1];

    const result = await this.database.query<OrderRow>(
      `UPDATE driver_order
       SET status = $1,
           completed_at = CASE WHEN $1 = 'completed' THEN now() ELSE completed_at END
       WHERE id = $2 AND driver_id = $3 AND status = $4
       RETURNING *`,
      [next, orderKey, id, row.status],
    );
    const updated = result.rows[0];
    if (!updated) {
      throw new BadRequestException('订单状态已变化，请刷新后重试');
    }
    return toOrderRecord(updated);
  }

  /** 司机放弃这一单：还回订单池，别的司机可以继续接 */
  async cancel(driverId: string, orderId: string): Promise<{ released: true }> {
    const id = requireDriverId(driverId);
    const orderKey = requireOrderId(orderId);
    const result = await this.database.query<{ id: string }>(
      `UPDATE driver_order
       SET status = 'pool', driver_id = NULL, accepted_at = NULL
       WHERE id = $1 AND driver_id = $2 AND status = ANY($3::text[])
       RETURNING id`,
      [orderKey, id, ['toPickup', 'waiting', 'inTrip']],
    );
    if (!result.rows[0]) {
      throw new BadRequestException('订单无法取消');
    }
    return { released: true };
  }

  private async seedPool(): Promise<void> {
    const result = await this.database.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM driver_order WHERE status = 'pool'`,
    );
    const existing = Number(result.rows[0]?.count ?? 0);
    if (existing >= POOL_TARGET) {
      this.logger.log(`订单池已有 ${existing} 单，无需预置`);
      return;
    }

    const missing = POOL_TARGET - existing;
    const orders = buildSeedOrders(missing);
    for (const order of orders) {
      await this.database.query(
        `INSERT INTO driver_order (
           passenger_name, passenger_phone, passenger_rating,
           from_name, from_address, from_longitude, from_latitude,
           to_name, to_address, to_longitude, to_latitude,
           pickup_km, pickup_minutes, trip_km, trip_minutes, fare, note
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           $10, $11, $12, $13, $14, $15, $16, $17
         )`,
        [
          order.passengerName,
          order.passengerPhone,
          order.passengerRating,
          order.from.name,
          order.from.address,
          order.from.longitude,
          order.from.latitude,
          order.to.name,
          order.to.address,
          order.to.longitude,
          order.to.latitude,
          order.pickupKm,
          order.pickupMinutes,
          order.tripKm,
          order.tripMinutes,
          order.fare,
          order.note,
        ],
      );
    }
    this.logger.log(`预置 ${missing} 单到订单池（当前共 ${POOL_TARGET} 单）`);
  }

  private async findOrCreate(phone: string): Promise<DriverRecord> {
    const existing = await this.findByPhone(phone);
    if (existing) return existing;

    try {
      const inserted = await this.database.query<DriverRow>(
        `INSERT INTO driver (phone, name, plate, car_model)
         VALUES ($1, $2, $3, $4)
         RETURNING ${DRIVER_COLUMNS}`,
        [phone, `司机${phone.slice(-4)}`, makePlate(), '比亚迪 秦PLUS'],
      );
      const created = inserted.rows[0];
      if (!created) {
        throw new Error('Driver was not created');
      }
      return toDriverRecord(created);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.findByPhone(phone);
      if (!winner) throw error;
      return winner;
    }
  }

  private async findByPhone(phone: string): Promise<DriverRecord | null> {
    const result = await this.database.query<DriverRow>(
      `SELECT ${DRIVER_COLUMNS} FROM driver WHERE phone = $1`,
      [phone],
    );
    const row = result.rows[0];
    return row ? toDriverRecord(row) : null;
  }

  private async requireDriver(id: string): Promise<DriverRecord> {
    const result = await this.database.query<DriverRow>(
      `SELECT ${DRIVER_COLUMNS} FROM driver WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('司机不存在');
    }
    return toDriverRecord(row);
  }
}

function toDriverRecord(row: DriverRow): DriverRecord {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    plate: row.plate,
    carModel: row.car_model,
    rating: Number(row.rating),
    status: row.status === 'online' ? 'online' : 'offline',
  };
}

function toOrderRecord(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    status: row.status as OrderStatus,
    passengerName: row.passenger_name,
    passengerPhone: row.passenger_phone,
    passengerRating:
      row.passenger_rating === null ? null : Number(row.passenger_rating),
    from: {
      name: row.from_name,
      address: row.from_address,
      longitude: Number(row.from_longitude),
      latitude: Number(row.from_latitude),
    },
    to: {
      name: row.to_name,
      address: row.to_address,
      longitude: Number(row.to_longitude),
      latitude: Number(row.to_latitude),
    },
    pickupKm: Number(row.pickup_km),
    pickupMinutes: Number(row.pickup_minutes),
    tripKm: Number(row.trip_km),
    tripMinutes: Number(row.trip_minutes),
    fare: Number(row.fare),
    note: row.note,
    acceptedAt: row.accepted_at ? row.accepted_at.toISOString() : null,
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  };
}

function makePlate(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const letter = letters[Math.floor(Math.random() * letters.length)] ?? 'A';
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `渝A·${letter}${digits}`;
}

export function requireDriverId(id: unknown): string {
  if (typeof id !== 'string' || !/^D[0-9]{5}$/.test(id)) {
    throw new NotFoundException('司机不存在');
  }
  return id;
}

export function requireOrderId(id: unknown): string {
  if (typeof id !== 'string' || !/^O[0-9]{6}$/.test(id)) {
    throw new BadRequestException('订单编号不正确');
  }
  return id;
}

export function requireDriverStatus(value: unknown): DriverStatus {
  if (value !== 'online' && value !== 'offline') {
    throw new BadRequestException('司机状态不正确');
  }
  return value;
}

export { requireCode, requirePhone };

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}
