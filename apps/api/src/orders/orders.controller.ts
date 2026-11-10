import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrdersService } from './orders.service.js';

@Controller('passengers/:id/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Param('id') id: string, @Body() body: unknown) {
    return this.orders.create(id, body);
  }

  @Get()
  all(@Param('id') id: string) {
    return this.orders.allForPassenger(id);
  }

  @Get('upcoming')
  upcoming(@Param('id') id: string) {
    return this.orders.upcomingForPassenger(id);
  }

  @Get('current')
  current(@Param('id') id: string) {
    return this.orders.current(id);
  }

  @Post(':orderId/cancel')
  cancel(@Param('id') id: string, @Param('orderId') orderId: string) {
    return this.orders.cancel(id, orderId);
  }
}
