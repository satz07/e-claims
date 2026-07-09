// src/config/sumsub.config.ts
import { registerAs } from '@nestjs/config';
import { IsString, IsUrl } from 'class-validator';
import validateConfig from '../utils/validate-config';
import { SumsubConfig } from './config.type';

class SumsubEnvironmentVariablesValidator {
  @IsString()
  SUMSUB_APP_TOKEN: string;

  @IsString()
  SUMSUB_SECRET_KEY: string;

  @IsUrl()
  SUMSUB_ROOT_URL: string;

  @IsString()
  SUMSUB_LEVEL_NAME: string;
}

export default registerAs<SumsubConfig>('sumsub', () => {
  validateConfig(process.env, SumsubEnvironmentVariablesValidator);

  return {
    appToken: process.env.SUMSUB_APP_TOKEN,
    secretKey: process.env.SUMSUB_SECRET_KEY,
    rootUrl: process.env.SUMSUB_ROOT_URL,
    levelName: process.env.SUMSUB_LEVEL_NAME,
  };
});
