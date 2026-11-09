import { Controller, Get, Param } from '@nestjs/common';
import { VehiclesService } from './vehicles.service.js';

@Controller('vehicle-options')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  list() {
    return this.vehicles.list();
  }

  @Get(':id/image')
  image(@Param('id') id: string) {
    return this.vehicles.image(id);
  }
}
