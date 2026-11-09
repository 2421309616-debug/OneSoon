import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

export type VehicleOption = {
  id: number;
  brand: string;
  model: string;
  modelYear: number;
  colorName: string;
  view: string;
  imageUrl: string;
};

const IMAGE_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

type VehicleOptionRow = Omit<VehicleOption, 'imageUrl'> & { imageFile: string };

@Injectable()
export class VehiclesService {
  constructor(private readonly database: DatabaseService) {}

  async list(): Promise<VehicleOption[]> {
    const result = await this.database.query<VehicleOptionRow>(
      `SELECT id, brand, model, model_year AS "modelYear", color_name AS "colorName", view, image_file AS "imageFile"
       FROM vehicle_option
       ORDER BY brand, model, model_year, color_name`,
    );
    return result.rows.map(toOption);
  }

  async image(rawId: string): Promise<StreamableFile> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id < 1) throw new NotFoundException('车型不存在');
    const result = await this.database.query<{ imageFile: string }>(
      `SELECT image_file AS "imageFile" FROM vehicle_option WHERE id = $1`,
      [id],
    );
    const filename = result.rows[0]?.imageFile;
    const matched = filename ? /^[a-z0-9][a-z0-9.-]+\.(jpg|png|webp)$/.exec(filename) : null;
    if (!filename || !matched) throw new NotFoundException('车型不存在');
    const path = join(vehicleImagesDirectory(), filename);
    try {
      await access(path);
    } catch {
      throw new NotFoundException('图片不存在');
    }
    return new StreamableFile(createReadStream(path), {
      type: IMAGE_TYPES[matched[1] as keyof typeof IMAGE_TYPES],
    });
  }
}

export function vehicleImagesDirectory(): string {
  return join(process.cwd(), 'data', 'vehicle-images');
}

function toOption(row: VehicleOptionRow): VehicleOption {
  const { imageFile, ...option } = row;
  return { ...option, imageUrl: `/vehicle-options/${option.id}/image?v=${encodeURIComponent(imageFile)}` };
}
