import { Body, Controller, Param, Post } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';

@Controller('drivers')
export class DriversController {
  constructor(private readonly service: DriversService) {}

  @Post()
  async createOrUpdate(@Body() body: CreateDriverDto) {
    const { id, lon, lat } = body;
    await this.service.updateLocation(String(id), lon, lat);
    return { ok: true };
  }

  @Post(':id/available')
  async setAvailable(@Param('id') id: string, @Body() body: SetAvailabilityDto) {
    const { available } = body;
    await this.service.setAvailability(id, available);
    return { ok: true };
  }
}
