import { registerAs } from '@nestjs/config';
import { IsString, IsOptional } from 'class-validator';
import validateConfig from '../utils/validate-config';
import { APPEndPointsConfig } from './config.type';

class EnvironmentVariablesValidator {
  // BACKEND
  @IsString()
  @IsOptional()
  TNT_AUTH_URL: string;
}

export default registerAs<APPEndPointsConfig>('appendpoints', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    backend: {
      authUrl: process.env.TNT_AUTH_URL,
    },
  };
});
