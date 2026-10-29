import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { VerificationCodesService } from './verification-codes.service.js';

export type PassengerRecord = {
  id: string;
  phone: string;
  nickname: string;
};

export type PlaceSearch = {
  placeId: string;
  name: string;
  address: string;
  longitude: number;
  latitude: number;
  searchCount: number;
};

@Injectable()
export class PassengersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly codes: VerificationCodesService,
  ) {}

  async enter(phone: string, code: string): Promise<PassengerRecord> {
    this.codes.verify(phone, code);
    return this.findOrCreate(phone);
  }

  private async findOrCreate(phone: string): Promise<PassengerRecord> {
    const existing = await this.findByPhone(phone);
    if (existing) return existing;

    try {
      const inserted = await this.database.query<PassengerRecord>(
        `INSERT INTO passenger (phone, nickname)
         VALUES ($1, $1)
         RETURNING id, phone, nickname`,
        [phone],
      );
      const created = inserted.rows[0];
      if (!created) {
        throw new Error('Passenger was not created');
      }
      return created;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.findByPhone(phone);
      if (!winner) throw error;
      return winner;
    }
  }

  async listPlaceSearches(passengerId: string): Promise<{ places: PlaceSearch[] }> {
    const id = requirePassengerId(passengerId);
    await this.requirePassenger(id);
    const result = await this.database.query<PlaceSearch>(
      `SELECT place_id AS "placeId",
              name,
              address,
              longitude,
              latitude,
              search_count AS "searchCount"
       FROM passenger_place_search
       WHERE passenger_id = $1
       ORDER BY search_count DESC, last_searched_at DESC, place_id ASC
       LIMIT 3`,
      [id],
    );
    return { places: result.rows };
  }

  async recordPlaceSearch(passengerId: string, body: unknown): Promise<PlaceSearch> {
    const id = requirePassengerId(passengerId);
    const place = requirePlace(body);
    await this.requirePassenger(id);
    const result = await this.database.query<PlaceSearch>(
      `INSERT INTO passenger_place_search
         (passenger_id, place_id, name, address, longitude, latitude)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (passenger_id, place_id) DO UPDATE
       SET name = EXCLUDED.name,
           address = EXCLUDED.address,
           longitude = EXCLUDED.longitude,
           latitude = EXCLUDED.latitude,
           search_count = passenger_place_search.search_count + 1,
           last_searched_at = now()
       RETURNING place_id AS "placeId",
                 name,
                 address,
                 longitude,
                 latitude,
                 search_count AS "searchCount"`,
      [id, place.placeId, place.name, place.address, place.longitude, place.latitude],
    );
    const saved = result.rows[0];
    if (!saved) {
      throw new Error('Place search was not saved');
    }
    return saved;
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

  private async findByPhone(phone: string): Promise<PassengerRecord | null> {
    const result = await this.database.query<PassengerRecord>(
      `SELECT id, phone, nickname FROM passenger WHERE phone = $1`,
      [phone],
    );
    return result.rows[0] ?? null;
  }
}

export function requirePhone(phone: unknown): string {
  if (typeof phone !== 'string' || phone.trim() === '') {
    throw new BadRequestException('请输入手机号');
  }
  return phone.trim();
}

export function requirePassengerId(id: unknown): string {
  if (typeof id !== 'string' || !/^[0-9]{5}$/.test(id)) {
    throw new NotFoundException('乘客不存在');
  }
  return id;
}

function requirePlace(body: unknown): {
  placeId: string;
  name: string;
  address: string;
  longitude: number;
  latitude: number;
} {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('请提供地点');
  }
  const value = body as Record<string, unknown>;
  const placeId = typeof value.placeId === 'string' ? value.placeId.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const address = typeof value.address === 'string' ? value.address.trim() : '';
  if (!placeId || placeId.length > 64) {
    throw new BadRequestException('请提供地点');
  }
  if (!name || name.length > 120) {
    throw new BadRequestException('请提供地点名称');
  }
  if (address.length > 240) {
    throw new BadRequestException('地点地址过长');
  }
  if (
    !isCoordinate(value.longitude, -180, 180) ||
    !isCoordinate(value.latitude, -90, 90)
  ) {
    throw new BadRequestException('地点坐标不正确');
  }
  return {
    placeId,
    name,
    address,
    longitude: value.longitude,
    latitude: value.latitude,
  };
}

function isCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function requireCode(code: unknown): string {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    throw new BadRequestException('请输入 6 位验证码');
  }
  return code.trim();
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}
