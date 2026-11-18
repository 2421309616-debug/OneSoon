import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { DriverLocationService } from './driver-location.service.js';
import { OfferService } from './offer.service.js';

interface LocationBody {
  longitude: number;
  latitude: number;
}

/**
 * 司机端轮询推送的接口。
 *
 * 司机端不主动拉「所有等待中的订单」，只问「有没有推给我的」——
 * 这是派单模式跟抢单模式最大的区别：一个订单同一时刻只在一个司机手上。
 */
@Controller('drivers/:driverId')
export class DispatchController {
  constructor(
    private readonly offers: OfferService,
    private readonly location: DriverLocationService,
  ) {}

  /** 我手上待响应的推送 */
  @Get('offers')
  async pending(@Param('driverId') driverId: string) {
    const offers = await this.offers.pendingOffers(driverId);
    return { offers };
  }

  /** 接受推送 */
  @Post('offers/:offerId/accept')
  async accept(@Param('driverId') driverId: string, @Param('offerId') offerId: string) {
    return this.offers.respond(driverId, offerId, true);
  }

  /** 拒绝推送（本单不再推给这个司机） */
  @Post('offers/:offerId/reject')
  async reject(@Param('driverId') driverId: string, @Param('offerId') offerId: string) {
    return this.offers.respond(driverId, offerId, false);
  }

  /** 上报位置。出车期间每 10 秒一次，超过 60 秒没上报就不参与派单 */
  @Put('location')
  async reportLocation(@Param('driverId') driverId: string, @Body() body: LocationBody) {
    await this.location.update(driverId, body.longitude, body.latitude);
    return { ok: true };
  }
}
