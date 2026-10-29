import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { PassengersModule } from './passengers/passengers.module.js';

@Module({
  imports: [DatabaseModule, PassengersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

