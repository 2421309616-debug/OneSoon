import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { DriversModule } from './drivers/drivers.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PassengersModule } from './passengers/passengers.module.js';

@Module({
  imports: [DatabaseModule, PassengersModule, OrdersModule, DriversModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

