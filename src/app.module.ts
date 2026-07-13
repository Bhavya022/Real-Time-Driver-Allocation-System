import { Module } from '@nestjs/common';
import { DriversController } from './drivers/drivers.controller';
import { RidesController } from './rides/rides.controller';
import { DriversService } from './drivers/drivers.service';
import { RidesService } from './rides/rides.service';
import { RedisService } from './redis/redis.service';
import { PGService } from './db/pg.service';
import { ReconcilerService } from './reconcile/reconciler.service';

@Module({
  imports: [],
  controllers: [DriversController, RidesController],
  providers: [RedisService, PGService, DriversService, RidesService, ReconcilerService],
})
export class AppModule {}
