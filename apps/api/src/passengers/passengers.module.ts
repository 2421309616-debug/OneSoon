import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { PassengersController } from './passengers.controller.js';
import { PassengersService } from './passengers.service.js';
import {
  CLOCK,
  VERIFICATION_CODE_GENERATOR,
  VerificationCodesService,
  createVerificationCode,
} from './verification-codes.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PassengersController],
  providers: [
    VerificationCodesService,
    PassengersService,
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
export class PassengersModule {}
