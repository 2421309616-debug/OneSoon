import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { DispatchController } from './dispatch.controller.js';
import { DispatchService } from './dispatch.service.js';
import { DriverLocationService } from './driver-location.service.js';
import { OfferService } from './offer.service.js';

@Module({
  imports: [DatabaseModule, OrdersModule],
  controllers: [DispatchController],
  providers: [DispatchService, OfferService, DriverLocationService],
  exports: [DispatchService, OfferService, DriverLocationService],
})
export class DispatchModule {}
