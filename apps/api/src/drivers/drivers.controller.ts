import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service.js';
import { requireCode, requirePhone } from '../passengers/passengers.service.js';
import { DriversService } from './drivers.service.js';
import { VerificationCodesService } from '../passengers/verification-codes.service.js';

@Controller('drivers')
export class DriversController {
  constructor(
    private readonly codes: VerificationCodesService,
    private readonly drivers: DriversService,
    private readonly orders: OrdersService,
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

  @Get()
  list(@Query('page') page?: string) {
    return this.drivers.list(page);
  }

  @Get(':id/orders/waiting')
  waitingOrders(@Param('id') id: string) {
    return this.orders.waitingForDriver(id);
  }

  @Get(':id/orders/current')
  currentOrder(@Param('id') id: string) {
    return this.orders.currentForDriver(id);
  }

  @Post(':id/orders/:orderId/accept')
  acceptOrder(@Param('id') id: string, @Param('orderId') orderId: string) {
    return this.orders.accept(id, orderId);
  }

  @Get(':id')
  profile(@Param('id') id: string) {
    return this.drivers.profile(id);
  }

  @Get(':id/photo')
  photo(@Param('id') id: string) {
    return this.drivers.photo(id);
  }

  @Post(':id/vehicle-type')
  setVehicleType(@Param('id') id: string, @Body() body: unknown) {
    return this.drivers.setVehicleType(id, body);
  }

  @Post(':id/profile/personal')
  savePersonal(@Param('id') id: string, @Body() body: unknown) {
    return this.drivers.savePersonal(id, body);
  }

  @Post(':id/profile/vehicle')
  saveVehicle(@Param('id') id: string, @Body() body: unknown) {
    return this.drivers.saveVehicle(id, body);
  }

  @Post(':id/profile/documents')
  saveDocuments(@Param('id') id: string, @Body() body: unknown) {
    return this.drivers.saveDocuments(id, body);
  }

  @Post(':id/profile')
  completeProfile(@Param('id') id: string, @Body() body: unknown) {
    return this.drivers.completeProfile(id, body);
  }
}

