import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import {
  CLOCK,
  VERIFICATION_CODE_GENERATOR,
  VerificationCodesService,
  createVerificationCode,
} from '../passengers/verification-codes.service.js';
import { DriversController } from './drivers.controller.js';
import { DriversService } from './drivers.service.js';

@Module({
  imports: [DatabaseModule, OrdersModule],
  controllers: [DriversController],
  providers: [
    VerificationCodesService,
    DriversService,
    {
      provide: VERIFICATION_CODE_GENERATOR,
      useValue: createVerificationCode,
    },
    {
      provide: CLOCK,
      useValue: () => Date.now(),
    },
  ],
})
export class DriversModule {}
