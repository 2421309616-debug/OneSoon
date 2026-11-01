import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { PassengersModule } from '../passengers/passengers.module.js';
import { DriversController } from './drivers.controller.js';
import { DriversService } from './drivers.service.js';

@Module({
  imports: [DatabaseModule, PassengersModule],
  controllers: [DriversController],
  providers: [DriversService],
})
export class DriversModule {}
