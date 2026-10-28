import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from './database.service.js';
import { onesoonEnvFile } from './onesoon-env-file.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: onesoonEnvFile(),
    }),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
