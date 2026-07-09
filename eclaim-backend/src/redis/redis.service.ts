import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { IORedisKey } from './redis.constants';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService {
  private readonly ttl: number;

  constructor(
    @Inject(IORedisKey)
    private readonly redisClient: Redis,
    private readonly configService: ConfigService,
  ) {
    this.ttl =
      this.configService.get<number>('redis.ttl', { infer: true }) ?? 60;
  }

  async getKeys(pattern = '*'): Promise<string[]> {
    return this.redisClient.keys(pattern);
  }

  async insert(key: string, value: unknown, ttl?: number): Promise<void> {
    await this.redisClient.set(
      key,
      JSON.stringify(value),
      'EX',
      ttl ?? this.ttl,
    );
  }

  async get<T = any>(key: string): Promise<T | null> {
    const data = await this.redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }

  async delete(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async validate(key: string, value: string): Promise<boolean> {
    const storedValue = await this.redisClient.get(key);
    return storedValue === value;
  }
}
