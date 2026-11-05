import {
  BadRequestException,
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

export type TripOrder = {
  id: string;
  status: 'waiting' | 'cancelled';
  pickup: Place;
  destination: Place;
  distanceMeters: number;
  durationSeconds: number;
  fareCents: number;
  createdAt: string;
};

type TripOrderRow = {
  id: string;
  status: 'waiting' | 'cancelled';
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
};

const COLUMNS = `id, status, pickup_name, pickup_longitude, pickup_latitude,
  destination_name, destination_longitude, destination_latitude,
  distance_meters, duration_seconds, fare_cents, created_at`;

@Injectable()
export class OrdersService {
  constructor(private readonly database: DatabaseService) {}

  async create(passengerId: string, body: unknown): Promise<TripOrder> {
    const id = requirePassengerId(passengerId);
    const trip = requireTrip(body);
    await this.requirePassenger(id);

    const existing = await this.findWaiting(id);
    if (existing) return existing;

    try {
      const inserted = await this.database.query<TripOrderRow>(
        `INSERT INTO trip_order
           (passenger_id, pickup_name, pickup_longitude, pickup_latitude,
            destination_name, destination_longitude, destination_latitude,
            distance_meters, duration_seconds, fare_cents)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING ${COLUMNS}`,
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
        ],
      );
      const created = inserted.rows[0];
      if (!created) {
        throw new Error('Trip order was not created');
      }
      return toOrder(created);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.findWaiting(id);
      if (!winner) throw error;
      return winner;
    }
  }

  async current(passengerId: string): Promise<{ order: TripOrder | null }> {
    const id = requirePassengerId(passengerId);
    await this.requirePassenger(id);
    return { order: await this.findWaiting(id) };
  }

  async cancel(passengerId: string, orderId: string): Promise<TripOrder> {
    const id = requirePassengerId(passengerId);
    if (!/^[0-9]{1,18}$/.test(orderId)) {
      throw new NotFoundException('订单不存在');
    }
    const result = await this.database.query<TripOrderRow>(
      `UPDATE trip_order
       SET status = 'cancelled', cancelled_at = COALESCE(cancelled_at, now())
       WHERE id = $1 AND passenger_id = $2
       RETURNING ${COLUMNS}`,
      [orderId, id],
    );
    const order = result.rows[0];
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    return toOrder(order);
  }

  private async findWaiting(passengerId: string): Promise<TripOrder | null> {
    const result = await this.database.query<TripOrderRow>(
      `SELECT ${COLUMNS} FROM trip_order
       WHERE passenger_id = $1 AND status = 'waiting'`,
      [passengerId],
    );
    const row = result.rows[0];
    return row ? toOrder(row) : null;
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
  };
}

function requireTrip(body: unknown): {
  pickup: Place;
  destination: Place;
  distanceMeters: number;
  durationSeconds: number;
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
  return {
    pickup,
    destination,
    distanceMeters: value.distanceMeters,
    durationSeconds: value.durationSeconds,
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
