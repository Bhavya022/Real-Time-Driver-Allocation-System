import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  client: Redis | null = null;

  async onModuleInit() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    await this.client.ping();
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  getClient() {
    if (!this.client) throw new Error('Redis not initialized');
    return this.client;
  }
}
