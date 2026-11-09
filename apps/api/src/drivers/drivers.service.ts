import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BadRequestException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { VerificationCodesService } from '../passengers/verification-codes.service.js';

export type DriverSession = {
  id: string;
  phone: string;
  displayName: string;
  profileComplete: boolean;
};

export type DriverProfile = {
  id: string;
  phone: string;
  name: string | null;
  vehicleModel: string | null;
  plate: string | null;
  photoUrl: string | null;
  vehicleImageUrl: string | null;
  personalComplete: boolean;
  vehicleComplete: boolean;
  documentsComplete: boolean;
  idOnFile: boolean;
};

const IMAGE_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

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
const DRIVER_PAGE_SIZE = 10;

export type DriverListItem = {
  id: string;
  phone: string;
  name: string | null;
  vehicleModel: string | null;
  plate: string | null;
  photoUrl: string | null;
  createdAt: string;
};

export type DriverList = {
  page: number;
  pageSize: number;
  total: number;
  drivers: DriverListItem[];
};

@Injectable()
export class DriversService {
  constructor(
    private readonly database: DatabaseService,
    private readonly codes: VerificationCodesService,
  ) {}

  async list(pageValue: unknown): Promise<DriverList> {
    const page = requirePage(pageValue);
    const totalResult = await this.database.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM driver`,
    );
    const offset = (page - 1) * DRIVER_PAGE_SIZE;
    const result = await this.database.query<{
      id: string;
      phone: string;
      name: string | null;
      vehicleModel: string | null;
      plate: string | null;
      photo: string | null;
      createdAt: Date | string;
    }>(
      `SELECT id, phone, name, vehicle_model AS "vehicleModel", plate, photo, created_at AS "createdAt"
       FROM driver
       ORDER BY created_at DESC, id DESC
       LIMIT $1 OFFSET $2`,
      [DRIVER_PAGE_SIZE, offset],
    );
    return {
      page,
      pageSize: DRIVER_PAGE_SIZE,
      total: totalResult.rows[0]?.total ?? 0,
      drivers: result.rows.map((row) => ({
        id: row.id,
        phone: row.phone,
        name: row.name,
        vehicleModel: row.vehicleModel,
        plate: row.plate,
        photoUrl: row.photo ? `/drivers/${row.id}/photo?v=${encodeURIComponent(row.photo)}` : null,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
      })),
    };
  }

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

  async savePersonal(driverId: string, body: unknown): Promise<DriverSession> {
    const id = requireDriverId(driverId);
    const current = await this.driverRecord(id);
    const value = requireRecord(body);
    const name = requireText(value.name, '请填写姓名', 40);
    const idNumber = resolveIdNumber(value.idNumber, current.idNumber);
    const photo = await resolveImage(id, 'photo', value.photo, current.photo, '请上传个人照片');
    try {
      await this.database.query(`UPDATE driver SET name = $2, id_number = $3, photo = $4 WHERE id = $1`, [
        id,
        name,
        idNumber,
        photo,
      ]);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      throw new BadRequestException('该身份证号已登记');
    }
    return this.sessionFor(id);
  }

  async saveVehicle(driverId: string, body: unknown): Promise<DriverSession> {
    const id = requireDriverId(driverId);
    await this.requireDriver(id);
    const value = requireRecord(body);
    const vehicleModel = requireVehicleType(value);
    const plate = requireText(value.plate, '请填写车牌', 12);
    await this.database.query(`UPDATE driver SET vehicle_model = $2, plate = $3 WHERE id = $1`, [
      id,
      vehicleModel,
      plate,
    ]);
    return this.sessionFor(id);
  }

  async saveDocuments(driverId: string, body: unknown): Promise<DriverSession> {
    const id = requireDriverId(driverId);
    const current = await this.driverRecord(id);
    const value = requireRecord(body);
    const driverLicense = await resolveImage(id, 'driver-license', value.driverLicense, current.driverLicense, '请上传驾驶证');
    const vehicleLicense = await resolveImage(id, 'vehicle-license', value.vehicleLicense, current.vehicleLicense, '请上传行驶证');
    await this.database.query(`UPDATE driver SET driver_license = $2, vehicle_license = $3 WHERE id = $1`, [
      id,
      driverLicense,
      vehicleLicense,
    ]);
    return this.sessionFor(id);
  }

  async setVehicleType(driverId: string, body: unknown): Promise<{ accepted: true }> {
    const id = requireDriverId(driverId);
    const vehicleModel = requireVehicleType(body);
    await this.requireDriver(id);
    await this.database.query(`UPDATE driver SET vehicle_model = $2 WHERE id = $1`, [id, vehicleModel]);
    return { accepted: true };
  }

  async profile(driverId: string): Promise<DriverProfile> {
    const id = requireDriverId(driverId);
    const result = await this.database.query<
      Omit<DriverProfile, 'photoUrl' | 'vehicleImageUrl'> & {
        photo: string | null;
        vehicleOptionId: number | null;
        vehicleImageFile: string | null;
      }
    >(
      `SELECT driver.id, driver.phone, driver.name, driver.vehicle_model AS "vehicleModel", driver.plate, driver.photo,
              (driver.name IS NOT NULL AND driver.id_number IS NOT NULL AND driver.photo IS NOT NULL) AS "personalComplete",
              (driver.vehicle_model IS NOT NULL AND driver.plate IS NOT NULL) AS "vehicleComplete",
              (driver.driver_license IS NOT NULL AND driver.vehicle_license IS NOT NULL) AS "documentsComplete",
              (driver.id_number IS NOT NULL) AS "idOnFile",
              vehicle_option.id AS "vehicleOptionId", vehicle_option.image_file AS "vehicleImageFile"
       FROM driver
       LEFT JOIN vehicle_option ON vehicle_option.category = driver.vehicle_model
       WHERE driver.id = $1
       ORDER BY vehicle_option.id
       LIMIT 1`,
      [id],
    );
    const driver = result.rows[0];
    if (!driver) throw new NotFoundException('司机不存在');
    const { photo, vehicleOptionId, vehicleImageFile, ...profile } = driver;
    return {
      ...profile,
      photoUrl: photo ? `/drivers/${id}/photo?v=${encodeURIComponent(photo)}` : null,
      vehicleImageUrl:
        vehicleOptionId && vehicleImageFile
          ? `/vehicle-options/${vehicleOptionId}/image?v=${encodeURIComponent(vehicleImageFile)}`
          : null,
    };
  }

  async photo(driverId: string): Promise<StreamableFile> {
    const id = requireDriverId(driverId);
    const result = await this.database.query<{ photo: string | null }>(
      `SELECT photo FROM driver WHERE id = $1`,
      [id],
    );
    const filename = result.rows[0]?.photo;
    const matched = filename ? /^[0-9]{5}-photo-[0-9a-f]{16}\.(jpg|png|webp)$/.exec(filename) : null;
    if (!filename || !matched) throw new NotFoundException('照片不存在');
    const path = join(driverFilesDirectory(), filename);
    try {
      await access(path);
    } catch {
      throw new NotFoundException('照片不存在');
    }
    return new StreamableFile(createReadStream(path), {
      type: IMAGE_TYPES[matched[1] as keyof typeof IMAGE_TYPES],
    });
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

  private async driverRecord(id: string): Promise<{
    idNumber: string | null;
    photo: string | null;
    driverLicense: string | null;
    vehicleLicense: string | null;
  }> {
    const result = await this.database.query<{
      idNumber: string | null;
      photo: string | null;
      driverLicense: string | null;
      vehicleLicense: string | null;
    }>(
      `SELECT id_number AS "idNumber", photo, driver_license AS "driverLicense", vehicle_license AS "vehicleLicense"
       FROM driver WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('司机不存在');
    return row;
  }

  private async sessionFor(id: string): Promise<DriverSession> {
    const result = await this.database.query<DriverRow>(
      `SELECT id, phone, name, ${PROFILE_COMPLETE} FROM driver WHERE id = $1`,
      [id],
    );
    const driver = result.rows[0];
    if (!driver) throw new NotFoundException('司机不存在');
    return toSession(driver);
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

function requirePage(value: unknown): number {
  if (value === undefined || value === null || value === '') return 1;
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) {
    throw new BadRequestException('页码不正确');
  }
  const page = Number(value);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger((page - 1) * DRIVER_PAGE_SIZE)) {
    throw new BadRequestException('页码不正确');
  }
  return page;
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

const VEHICLE_TYPES = ['跑车', '轿车'];

function requireRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) throw new BadRequestException('请填写认证资料');
  return body as Record<string, unknown>;
}

function resolveIdNumber(value: unknown, current: string | null): string {
  const text = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!text) {
    if (current) return current;
    throw new BadRequestException('请填写身份证号');
  }
  if (!/^[0-9]{17}[0-9X]$/.test(text)) throw new BadRequestException('身份证号不正确');
  return text;
}

async function resolveImage(
  driverId: string,
  kind: string,
  value: unknown,
  current: string | null,
  message: string,
): Promise<string> {
  if (typeof value === 'string' && value.startsWith('data:image/')) return writeDriverImage(driverId, kind, value);
  if (current) return current;
  throw new BadRequestException(message);
}

function requireVehicleType(body: unknown): string {
  const value = typeof body === 'object' && body !== null ? (body as { vehicleModel?: unknown }).vehicleModel : undefined;
  const vehicleModel = typeof value === 'string' ? value.trim() : '';
  if (!VEHICLE_TYPES.includes(vehicleModel)) throw new BadRequestException('请选择车型');
  return vehicleModel;
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
  const directory = driverFilesDirectory();
  await mkdir(directory, { recursive: true });
  const filename = `${driverId}-${kind}-${randomBytes(8).toString('hex')}.${extension}`;
  await writeFile(join(directory, filename), buffer);
  return filename;
}

function driverFilesDirectory(): string {
  return join(process.cwd(), 'data', 'driver-files');
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
