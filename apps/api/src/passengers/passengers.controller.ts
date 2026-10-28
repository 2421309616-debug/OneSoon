import { Body, Controller, Post } from '@nestjs/common';
import {
  PassengersService,
  requireCode,
  requirePhone,
} from './passengers.service.js';
import { VerificationCodesService } from './verification-codes.service.js';

@Controller('passengers')
export class PassengersController {
  constructor(
    private readonly codes: VerificationCodesService,
    private readonly passengers: PassengersService,
  ) {}

  @Post('verification-codes')
  issue(@Body() body: { phone?: unknown }) {
    this.codes.issue(requirePhone(body?.phone));
    return { accepted: true };
  }

  @Post('sessions')
  enter(@Body() body: { phone?: unknown; code?: unknown }) {
    return this.passengers.enter(requirePhone(body?.phone), requireCode(body?.code));
  }
}
