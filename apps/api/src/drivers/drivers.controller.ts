import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { VerificationCodesService } from '../passengers/verification-codes.service.js';
import { requireCode, requirePhone } from '../passengers/passengers.service.js';
import { DriversService, requireDriverStatus } from './drivers.service.js';

@Controller()
export class DriversController {
  constructor(
    private readonly codes: VerificationCodesService,
    private readonly drivers: DriversService,
  ) {}

  @Post('drivers/verification-codes')
  issue(@Body() body: { phone?: unknown }) {
    this.codes.issue(requirePhone(body?.phone));
    return { accepted: true };
  }

  @Post('drivers/sessions')
  enter(@Body() body: { phone?: unknown; code?: unknown }) {
    return this.drivers.enter(
      requirePhone(body?.phone),
      requireCode(body?.code),
    );
  }

  @Get('drivers/:id')
  findById(@Param('id') id: string) {
    return this.drivers.findById(id);
  }

  @Put('drivers/:id/status')
  setStatus(@Param('id') id: string, @Body() body: { status?: unknown }) {
    return this.drivers.setStatus(id, requireDriverStatus(body?.status));
  }

  @Get('drivers/:id/orders')
  listOrders(@Param('id') id: string) {
    return this.drivers.listOrders(id);
  }

  @Get('drivers/:id/stats')
  stats(@Param('id') id: string) {
    return this.drivers.stats(id);
  }

  @Get('orders/pool')
  pool() {
    return this.drivers.pool();
  }

  @Post('drivers/:id/orders/:orderId/accept')
  accept(@Param('id') id: string, @Param('orderId') orderId: string) {
    return this.drivers.accept(id, orderId);
  }

  @Post('drivers/:id/orders/:orderId/advance')
  advance(@Param('id') id: string, @Param('orderId') orderId: string) {
    return this.drivers.advance(id, orderId);
  }

  @Delete('drivers/:id/orders/:orderId')
  cancel(@Param('id') id: string, @Param('orderId') orderId: string) {
    return this.drivers.cancel(id, orderId);
  }
}
