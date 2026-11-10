import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { requirePassengerId } from '../passengers/passengers.service.js';

export const FARE_CENTS = 1000;

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

  async waitingForDriver(driverId: string): Promise<{ orders: TripOrder[] }> {
    await this.requireDriver(driverId);
    const result = await this.database.query<TripOrderRow>(
      `${ORDER_SELECT}
       WHERE o.status = 'waiting'
         AND (o.is_reservation = false OR o.scheduled_at <= now())
       ORDER BY o.created_at ASC, o.id ASC`,
    );
    return { orders: result.rows.map(toOrder) };
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

  async accept(driverId: string, orderId: string): Promise<TripOrder> {
    await this.requireDriver(driverId);
    if (!/^[0-9]{1,18}$/.test(orderId)) {
      throw new NotFoundException('订单不存在');
    }
    const held = await this.database.query<{ id: string }>(
      `SELECT id FROM trip_order WHERE driver_id = $1 AND status = 'accepted'`,
      [driverId],
    );
    const heldId = held.rows[0]?.id;
    if (heldId && heldId !== orderId) {
      throw new BadRequestException('请先完成当前订单');
    }
    if (heldId === orderId) return this.requireOrder(orderId);

    try {
      const updated = await this.database.query<{ id: string }>(
        `UPDATE trip_order
         SET status = 'accepted', driver_id = $2, accepted_at = now()
         WHERE id = $1 AND status = 'waiting'
         RETURNING id`,
        [orderId, driverId],
      );
      if (updated.rows[0]) return this.requireOrder(orderId);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      throw new BadRequestException('请先完成当前订单');
    }

    const existing = await this.database.query<{ status: string; driver_id: string | null }>(
      `SELECT status, driver_id FROM trip_order WHERE id = $1`,
      [orderId],
    );
    const row = existing.rows[0];
    if (!row) throw new NotFoundException('订单不存在');
    if (row.status === 'accepted' && row.driver_id === driverId) return this.requireOrder(orderId);
    if (row.status === 'accepted') throw new ConflictException('订单已被接走');
    throw new BadRequestException('订单已取消');
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
    if (result.rows[0]) return this.requireOrder(orderId);
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
