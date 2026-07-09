import { registerAs } from '@nestjs/config';
import { IsNotEmpty, IsString } from 'class-validator';
import validateConfig from 'src/utils/validate-config';
import { DtpsConfig } from './config.type';

class EnvironmentVariablesValidator {
  @IsString()
  @IsNotEmpty()
  DTPS_SECRET_KEY: string;

  @IsString()
  @IsNotEmpty()
  DTPS_BASE_URL: string;

  @IsString()
  @IsNotEmpty()
  DTPS_API_KEY: string;
}

export default registerAs<DtpsConfig>('dtps', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    secret_key: process.env.DTPS_SECRET_KEY as string,
    base_url: process.env.DTPS_BASE_URL as string,
    api_key: process.env.DTPS_API_KEY as string,
  };
});
