import { readFileSync } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { onesoonEnvFile } from '../src/database/onesoon-env-file.ts';
import {
  displayBrand,
  displayColor,
  displayModel,
  imageFileName,
  parseCarImageUrl,
  type CarImageRequest,
} from '../src/vehicles/car-image-request.ts';

const here = dirname(fileURLToPath(import.meta.url));

type CatalogMatch = {
  make_slug: string;
  model_slug: string;
  make_name: string;
  model_name: string;
  ids: Record<string, string>;
};

const url = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
const force = process.argv.includes('--force');

if (!url) {
  console.error('用法: npm run car-image -- "https://carimage.dev/images/car.png?..."');
  process.exit(1);
}

try {
  const saved = await importCarImage(url, force);
  console.log(`${saved.created ? '已保存' : '这张图已经保存过'} ${saved.brand} ${saved.model} ${saved.modelYear} ${saved.colorName}`);
  console.log(`编号 ${saved.id}`);
  console.log(`文件 ${saved.imageFile}`);
  if (saved.usage) console.log(saved.usage);
} catch (error) {
  console.error(error instanceof Error ? error.message : '保存车辆图片失败');
  process.exit(1);
}

async function importCarImage(input: string, replace: boolean) {
  const request = parseCarImageUrl(input);
  loadEnv(onesoonEnvFile());
  const key = process.env.CAR_IMAGE_API_KEY;
  const connectionString = process.env.DATABASE_URL;
  if (!key) throw new Error('请在 .env 里设置 CAR_IMAGE_API_KEY');
  if (!connectionString) throw new Error('请在 .env 里设置 DATABASE_URL');

  const vehicle = await resolveVehicle(request);
  const brand = displayBrand(request.makeSlug, vehicle.makeName);
  const model = displayModel(vehicle.modelName);
  const colorName = displayColor(request.color);
  const imageFile = imageFileName(request);

  const pool = new Pool({ connectionString });
  try {
    await applyVehicleSchema(pool);
    const imagePath = resolve(here, '../data/vehicle-images', imageFile);
    const existing = await pool.query<{ id: number }>(
      `SELECT id FROM vehicle_option WHERE source_vehicle_id = $1 AND color_key = $2 AND view = $3`,
      [vehicle.vehicleId, request.color, request.view],
    );
    const current = existing.rows[0];
    if (current && !replace && (await fileExists(imagePath))) {
      return { created: false, id: current.id, brand, model, modelYear: request.year, colorName, imageFile, usage: '' };
    }

    const usage = await downloadImage(request, vehicle.vehicleId, key, imagePath);
    const saved = await pool.query<{ id: number }>(
      `INSERT INTO vehicle_option (brand, model, model_year, color_name, color_key, view, image_file, source_vehicle_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (source_vehicle_id, color_key, view)
       DO UPDATE SET brand = EXCLUDED.brand,
                     model = EXCLUDED.model,
                     model_year = EXCLUDED.model_year,
                     color_name = EXCLUDED.color_name,
                     image_file = EXCLUDED.image_file
       RETURNING id`,
      [brand, model, request.year, colorName, request.color, request.view, imageFile, vehicle.vehicleId],
    );
    const id = saved.rows[0]?.id;
    if (!id) throw new Error('车型没有写入数据库');
    return { created: true, id, brand, model, modelYear: request.year, colorName, imageFile, usage };
  } finally {
    await pool.end();
  }
}

function loadEnv(file: string) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator);
    let value = trimmed.slice(separator + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function resolveVehicle(request: CarImageRequest) {
  const query = new URL('https://carimage.dev/api/v1/vehicles');
  query.searchParams.set('q', `${request.makeSlug} ${request.modelSlug.replaceAll('-', ' ')}`);
  const response = await fetch(query);
  if (!response.ok) throw new Error('车型目录暂时查不到，请稍后再试');
  const body = (await response.json()) as { data?: { results?: CatalogMatch[] } };
  const match = body.data?.results?.find(
    (item) => item.make_slug === request.makeSlug && item.model_slug === request.modelSlug && item.ids?.[String(request.year)],
  );
  const vehicleId = match?.ids[String(request.year)];
  if (!match || !vehicleId) throw new Error(`目录里没有 ${request.makeSlug} ${request.modelSlug} ${request.year}`);
  return { vehicleId, makeName: match.make_name, modelName: match.model_name };
}

async function downloadImage(request: CarImageRequest, vehicleId: string, key: string, path: string) {
  const imageUrl = new URL('https://carimage.dev/api/v1/images/car');
  imageUrl.searchParams.set('vehicle', vehicleId);
  imageUrl.searchParams.set('view', request.view);
  imageUrl.searchParams.set('color', request.color);
  imageUrl.searchParams.set('format', request.format);
  if (request.width) imageUrl.searchParams.set('w', String(request.width));

  const response = await fetch(imageUrl, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(await imageError(response));
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!matchesFormat(bytes, request.format)) throw new Error('下载到的不是车辆图片');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  const used = response.headers.get('x-vehicle-images-used');
  const included = response.headers.get('x-vehicle-images-included');
  return used && included ? `本月已用图片 ${used} / ${included}` : '';
}

async function imageError(response: Response) {
  if (response.status === 402) return '这个月的免费车辆图片额度已用完';
  const text = await response.text();
  const message = text.match(/"message"\s*:\s*"([^"]+)"/)?.[1];
  return message || `车辆图片下载失败（${response.status}）`;
}

async function fileExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function matchesFormat(bytes: Buffer, format: CarImageRequest['format']) {
  if (format === 'png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (format === 'jpg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
}

async function applyVehicleSchema(pool: Pool) {
  const sql = readFileSync(resolve(here, '../src/database/vehicle.sql'), 'utf8');
  for (const statement of sql.split(';').map((item) => item.trim()).filter(Boolean)) {
    await pool.query(statement);
  }
}
