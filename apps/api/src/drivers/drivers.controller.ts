import { Body, Controller, Param, Post } from '@nestjs/common';
import { requireCode, requirePhone } from '../passengers/passengers.service.js';
import { DriversService } from './drivers.service.js';
import { VerificationCodesService } from '../passengers/verification-codes.service.js';

@Controller('drivers')
export class DriversController {
  constructor(
    private readonly codes: VerificationCodesService,
    private readonly drivers: DriversService,
  ) {}

  @Post('verification-codes')
  issue(@Body() body: { phone?: unknown }) {
    this.codes.issue(requirePhone(body?.phone));
    return { accepted: true };
  }

  @Post('sessions')
  enter(@Body() body: { phone?: unknown; code?: unknown }) {
    return this.drivers.enter(requirePhone(body?.phone), requireCode(body?.code));
  }

  @Post(':id/profile')
  completeProfile(@Param('id') id: string, @Body() body: unknown) {
    return this.drivers.completeProfile(id, body);
  }
}

