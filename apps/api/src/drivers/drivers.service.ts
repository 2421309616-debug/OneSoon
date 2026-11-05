import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { VerificationCodesService } from '../passengers/verification-codes.service.js';

export type DriverSession = {
  id: string;
  phone: string;
  displayName: string;
  profileComplete: boolean;
};

type DriverRow = {
  id: string;
  phone: string;
  name: string | null;
  profileComplete: boolean;
};

const PROFILE_COMPLETE = `(
  name IS NOT NULL AND id_number IS NOT NULL AND vehicle_model IS NOT NULL
  AND plate IS NOT NULL AND photo IS NOT NULL AND driver_license IS NOT NULL
  AND vehicle_license IS NOT NULL
) AS "profileComplete"`;

const IMAGE_LIMIT = 5 * 1024 * 1024;

@Injectable()
export class DriversService {
  constructor(
    private readonly database: DatabaseService,
    private readonly codes: VerificationCodesService,
  ) {}

  async enter(phone: string, code: string): Promise<DriverSession> {
    this.codes.verify(phone, code);
    return toSession(await this.findOrCreate(phone));
  }

  async completeProfile(driverId: string, body: unknown): Promise<DriverSession> {
    const id = requireDriverId(driverId);
    const profile = requireProfile(body);
    await this.requireDriver(id);
    const photo = await writeDriverImage(id, 'photo', profile.photo);
    const driverLicense = await writeDriverImage(id, 'driver-license', profile.driverLicense);
    const vehicleLicense = await writeDriverImage(id, 'vehicle-license', profile.vehicleLicense);

    try {
      const updated = await this.database.query<DriverRow>(
        `UPDATE driver
         SET name = $2,
             id_number = $3,
             vehicle_model = $4,
             plate = $5,
             photo = $6,
             driver_license = $7,
             vehicle_license = $8
         WHERE id = $1
         RETURNING id, phone, name, ${PROFILE_COMPLETE}`,
        [
          id,
          profile.name,
          profile.idNumber,
          profile.vehicleModel,
          profile.plate,
          photo,
          driverLicense,
          vehicleLicense,
        ],
      );
      const driver = updated.rows[0];
      if (!driver) throw new NotFoundException('司机不存在');
      return toSession(driver);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      throw new BadRequestException('该身份证号已登记');
    }
  }

  private async findOrCreate(phone: string): Promise<DriverRow> {
    const existing = await this.findByPhone(phone);
    if (existing) return existing;

    try {
      const inserted = await this.database.query<DriverRow>(
        `INSERT INTO driver (phone)
         VALUES ($1)
         RETURNING id, phone, name, ${PROFILE_COMPLETE}`,
        [phone],
      );
      const created = inserted.rows[0];
      if (!created) throw new Error('Driver was not created');
      return created;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.findByPhone(phone);
      if (!winner) throw error;
      return winner;
    }
  }

  private async findByPhone(phone: string): Promise<DriverRow | null> {
    const result = await this.database.query<DriverRow>(
      `SELECT id, phone, name, ${PROFILE_COMPLETE} FROM driver WHERE phone = $1`,
      [phone],
    );
    return result.rows[0] ?? null;
  }

  private async requireDriver(id: string): Promise<void> {
    const result = await this.database.query(`SELECT id FROM driver WHERE id = $1`, [id]);
    if (!result.rows[0]) throw new NotFoundException('司机不存在');
  }
}

function toSession(driver: DriverRow): DriverSession {
  return {
    id: driver.id,
    phone: driver.phone,
    displayName: driver.name ?? driver.phone,
    profileComplete: driver.profileComplete,
  };
}

function requireDriverId(id: string): string {
  if (!/^[0-9]{5}$/.test(id)) throw new NotFoundException('司机不存在');
  return id;
}

type ProfileInput = {
  name: string;
  idNumber: string;
  vehicleModel: string;
  plate: string;
  photo: string;
  driverLicense: string;
  vehicleLicense: string;
};

function requireProfile(body: unknown): ProfileInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('请填写认证资料');
  }
  const value = body as Record<string, unknown>;
  return {
    name: requireText(value.name, '请填写姓名', 40),
    idNumber: requireIdNumber(value.idNumber),
    vehicleModel: requireText(value.vehicleModel, '请填写车型', 40),
    plate: requireText(value.plate, '请填写车牌', 12),
    photo: requireImage(value.photo, '请上传个人照片'),
    driverLicense: requireImage(value.driverLicense, '请上传驾驶证'),
    vehicleLicense: requireImage(value.vehicleLicense, '请上传行驶证'),
  };
}

function requireText(value: unknown, message: string, max: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max) throw new BadRequestException(message);
  return text;
}

function requireIdNumber(value: unknown): string {
  const text = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[0-9]{17}[0-9X]$/.test(text)) throw new BadRequestException('身份证号不正确');
  return text;
}

function requireImage(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.startsWith('data:image/')) {
    throw new BadRequestException(message);
  }
  return value;
}

async function writeDriverImage(driverId: string, kind: string, dataUrl: string): Promise<string> {
  const matched = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!matched) throw new BadRequestException('请上传 jpg、png 或 webp 图片');
  const buffer = Buffer.from(matched[2].replace(/\s/g, ''), 'base64');
  const extension = imageExtension(buffer, matched[1]);
  if (!extension || buffer.length === 0) {
    throw new BadRequestException('请上传 jpg、png 或 webp 图片');
  }
  if (buffer.length > IMAGE_LIMIT) throw new BadRequestException('图片不能超过 5MB');
  const directory = join(process.cwd(), 'data', 'driver-files');
  await mkdir(directory, { recursive: true });
  const filename = `${driverId}-${kind}-${randomBytes(8).toString('hex')}.${extension}`;
  await writeFile(join(directory, filename), buffer);
  return filename;
}

function imageExtension(buffer: Buffer, declared: string): 'jpg' | 'png' | 'webp' | null {
  if (
    declared === 'png' &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (
    (declared === 'jpeg' || declared === 'jpg') &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpg';
  }
  if (
    declared === 'webp' &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}
