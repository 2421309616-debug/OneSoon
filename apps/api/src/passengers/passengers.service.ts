import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { VerificationCodesService } from './verification-codes.service.js';

export type PassengerRecord = {
  id: string;
  phone: string;
  nickname: string;
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
