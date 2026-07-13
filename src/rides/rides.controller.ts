import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RidesService } from './rides.service';
import { RequestRideDto } from './dto/request-ride.dto';
import { AcceptRideDto } from './dto/accept-ride.dto';

@Controller('rides')
export class RidesController {
  constructor(private readonly service: RidesService) {}

  @Post()
  async requestRide(@Body() body: RequestRideDto) {
    return this.service.requestRide(body.lon, body.lat);
  }

  @Post(':id/accept')
  async acceptRide(@Param('id') rideId: string, @Body() body: AcceptRideDto) {
    const uuidRegex = /^[0-9a-fA-F-]{36}$/;
    if (!uuidRegex.test(rideId)) {
      throw new BadRequestException('invalid rideId');
    }
    return this.service.acceptRide(rideId, String(body.driverId));
  }

  @Get(':id')
  async getRide(@Param('id') rideId: string) {
    return this.service.getRide(rideId);
  }
}
