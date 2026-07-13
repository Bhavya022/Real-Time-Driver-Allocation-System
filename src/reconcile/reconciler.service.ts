import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PGService } from '../db/pg.service';

@Injectable()
export class ReconcilerService implements OnModuleInit, OnModuleDestroy {
  redis: RedisService;
  pg: PGService;
  intervalMs: number;
  timer: NodeJS.Timeout | null = null;

  constructor(redis: RedisService, pg: PGService) {
    this.redis = redis;
    this.pg = pg;
    this.intervalMs = Number(process.env.RECONCILE_INTERVAL_MS || '10000');
  }

  onModuleInit() {
    this.start();
  }

  onModuleDestroy() {
    this.stop();
  }

  start() {
    this.timer = setInterval(() => this.reconcileAssignedRides(), this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async reconcileAssignedRides() {
    const client = this.redis.getClient();
    let cursor = '0';
    try {
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', 'ride:*', 'COUNT', 100);
        cursor = nextCursor as string;
        for (const key of keys as string[]) {
          if (!/^[0-9a-fA-F-]{36}$/.test(key.replace(/^ride:/, ''))) {
            continue;
          }
          const rideId = key.replace(/^ride:/, '');
          const [assigned, state, lon, lat] = await client.hmget(key, 'assigned', 'state', 'lon', 'lat');
          if (!assigned) continue;
          const pgRide = await this.pg.getRide(rideId);
          if (!pgRide || pgRide.assigned_driver !== assigned || pgRide.state !== state) {
            await this.pg.reconcileRide(rideId, state || 'SEARCHING', Number(lon || 0), Number(lat || 0), assigned);
            console.log(`Reconciled ride ${rideId} assigned_driver=${assigned}`);
          }
        }
      } while (cursor !== '0');
    } catch (error) {
      console.error('Reconciliation error', error);
    }
  }
}
