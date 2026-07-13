import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class DriversService {
  redis: RedisService;
  GEO_KEY = 'drivers:geo';

  constructor(redis: RedisService) {
    this.redis = redis;
  }

  async updateLocation(driverId: string, lon: number, lat: number) {
    const client = this.redis.getClient();
    await client.geoadd(this.GEO_KEY, lon, lat, driverId);
    await client.hset(`driver:${driverId}`, 'available', '1');
  }

  async setAvailability(driverId: string, available: boolean) {
    const client = this.redis.getClient();
    await client.hset(`driver:${driverId}`, 'available', available ? '1' : '0');
  }

  async findNearby(lon: number, lat: number, radiusKm = 5, count = 10) {
    const client = this.redis.getClient();
    const res = await client.georadius(this.GEO_KEY, lon, lat, radiusKm, 'km', 'WITHDIST', 'ASC', 'COUNT', count);
    const nearby = [] as { id: string; dist: number }[];
    for (const item of res as any[]) {
      const id = item[0];
      const dist = parseFloat(item[1]);
      const avail = await client.hget(`driver:${id}`, 'available');
      if (avail === '1') nearby.push({ id, dist });
    }
    return nearby;
  }
}
