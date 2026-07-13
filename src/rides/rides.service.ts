import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { DriversService } from '../drivers/drivers.service';
import { PGService } from '../db/pg.service';
import { v4 as uuidv4 } from 'uuid';

type State = 'REQUESTED' | 'SEARCHING' | 'ASSIGNED' | 'TIMEOUT';

@Injectable()
export class RidesService {
  redis: RedisService;
  drivers: DriversService;
  pg: PGService;
  RIDE_PREFIX = 'ride:';
  ASSIGN_SCRIPT = `
    local ride_key = KEYS[1]
    local assigned = redis.call('hget', ride_key, 'assigned')
    if assigned and assigned ~= '' then
      if assigned == ARGV[1] then
        return {'ALREADY_ASSIGNED', assigned}
      else
        return {'ALREADY_TAKEN', assigned}
      end
    end
    -- assign
    redis.call('hset', ride_key, 'assigned', ARGV[1])
    redis.call('hset', ride_key, 'state', 'ASSIGNED')
    return {'ASSIGNED', ARGV[1]}
  `;

  constructor(redis: RedisService, drivers: DriversService, pg: PGService) {
    this.redis = redis;
    this.drivers = drivers;
    this.pg = pg;
  }

  async requestRide(lon: number, lat: number, radiusKm = 5) {
    const client = this.redis.getClient();
    const rideId = uuidv4();
    const rideKey = this.RIDE_PREFIX + rideId;
    await client.hset(rideKey, 'state', 'SEARCHING', 'lon', lon.toString(), 'lat', lat.toString());

    try {
      await this.pg.insertRide(rideId, lon, lat, 'SEARCHING');
    } catch (e) {
      console.error('PG insert failed', e);
    }

    const candidates = await this.drivers.findNearby(lon, lat, radiusKm, 10);
    const candidateIds = candidates.map((c) => c.id);
    if (candidateIds.length === 0) {
      await client.hset(rideKey, 'state', 'TIMEOUT');
      return { rideId, state: 'TIMEOUT' };
    }
    if (candidateIds.length > 0) await client.rpush(`${rideKey}:candidates`, ...candidateIds);
    this.startAllocationWatch(rideId);

    return { rideId, candidates: candidateIds };
  }

  async startAllocationWatch(rideId: string, windowMs = 8000, maxRetries = 2) {
    const client = this.redis.getClient();
    const rideKey = this.RIDE_PREFIX + rideId;
    let attempts = 0;

    const attempt = async () => {
      attempts += 1;
      const state = await client.hget(rideKey, 'state');
      if (state === 'ASSIGNED') return;

      await new Promise((r) => setTimeout(r, windowMs));

      const st = await client.hget(rideKey, 'state');
      if (st === 'ASSIGNED') return;

      const next = await client.lrange(`${rideKey}:candidates`, 0, 9);
      if (!next || next.length === 0) {
        await client.hset(rideKey, 'state', 'TIMEOUT');
        return;
      }

      if (attempts < maxRetries) {
        attempt();
      } else {
        const finalState = await client.hget(rideKey, 'state');
        if (finalState !== 'ASSIGNED') await client.hset(rideKey, 'state', 'TIMEOUT');
      }
    };

    attempt();
  }

  async acceptRide(rideId: string, driverId: string) {
    const client = this.redis.getClient();
    const rideKey = this.RIDE_PREFIX + rideId;
    const script = this.ASSIGN_SCRIPT;
    const res = await client.eval(script, 1, rideKey, driverId) as [string, string] | null;

    if (!res || res.length !== 2) {
      const assigned = await client.hget(rideKey, 'assigned');
      if (assigned) return { ok: false, reason: 'ALREADY_TAKEN', assignedTo: assigned };
      return { ok: false, reason: 'UNKNOWN' };
    }

    const [status, assignedDriver] = res;
    if (status === 'ASSIGNED') {
      try {
        const ok = await this.pg.setAssigned(rideId, driverId);
        if (!ok) {
          console.warn('PG did not record assignment because assigned_driver was already set for', rideId);
        }
      } catch (e) {
        console.error('PG setAssigned failed', e);
      }
      return { ok: true, assignedTo: assignedDriver };
    }

    return { ok: false, reason: status, assignedTo: assignedDriver };
  }

  async getRide(rideId: string) {
    const client = this.redis.getClient();
    const rideKey = this.RIDE_PREFIX + rideId;
    const state = await client.hgetall(rideKey);
    return state;
  }
}
