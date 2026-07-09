import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import Redis from 'ioredis';
import { RedisService } from './redis.service';
import { IORedisKey } from './redis.constants';
//for test
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: IORedisKey,
      useFactory: async (configService: ConfigService) => {
        const redisConfig = configService.get('redis');
        const isProduction = configService.get('app.nodeEnv') === 'production';
        const client = new Redis({
          ...redisConfig,
          ...(isProduction ? { tls: {} } : {}),
        });

        client.on('connect', () => {
          console.log('✅ Redis connected');
        });

        client.on('error', (err) => {
          console.error('❌ Redis error:', err.message);
        });

        return client;
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown(signal?: string): Promise<void> {
    const redis = this.moduleRef.get(IORedisKey);
    console.log(`❌ Shutting down Redis connection due to signal: ${signal}`);
    return new Promise<void>((resolve) => {
      redis.quit();
      redis.on('end', () => {
        resolve();
      });
    });
  }
}
