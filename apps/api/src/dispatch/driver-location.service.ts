import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

/**
 * 司机位置上报。
 *
 * 派单的第一层过滤是「位置新鲜」—— 位置超过 60 秒没更新，算出来的距离没有意义。
 * 所以出车期间司机端每 10 秒上报一次，收车后停止。
 *
 * 为什么单独一个 service：位置是高频写入（每个在线司机 6 次/分钟），
 * 和「订单状态」「推送响应」是不同生命周期的数据，混在一起以后不好拆。
 */
@Injectable()
export class DriverLocationService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * 更新司机坐标。
   *
   * 只更新坐标和更新时间，不动 `status` —— 出车/收车是另一个接口。
   * 这样「位置上报失败」不会意外把司机踢下线。
   */
  async update(driverId: string, longitude: number, latitude: number): Promise<void> {
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new BadRequestException('经度超出范围');
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new BadRequestException('纬度超出范围');
    }

    await this.database.query(
      `UPDATE driver
          SET longitude = $2, latitude = $3, location_updated_at = now()
        WHERE id = $1`,
      [driverId, longitude, latitude],
    );
  }
}
