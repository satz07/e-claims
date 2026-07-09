// src/config/redis.config.ts
import { registerAs } from '@nestjs/config';
import { IsString, IsNumberString } from 'class-validator';
import validateConfig from '../utils/validate-config';
import { RedisConfig } from './config.type';

class RedisEnvironmentVariablesValidator {
  @IsString()
  REDIS_HOST: string;

  @IsString()
  REDIS_PASSWORD: string;

  @IsNumberString()
  REDIS_PORT: string;

  @IsNumberString()
  REDIS_TTL: string;
}

export default registerAs<RedisConfig>('redis', () => {
  validateConfig(process.env, RedisEnvironmentVariablesValidator);

  return {
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_PASSWORD || undefined,
    port: parseInt(process.env.REDIS_PORT, 10),
    ttl: parseInt(process.env.REDIS_TTL, 10),
    maxRetriesPerRequest: 5,
  };
});
