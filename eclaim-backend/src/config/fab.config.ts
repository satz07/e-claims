import { registerAs } from '@nestjs/config';
import { IsString, IsUrl, IsOptional } from 'class-validator';
import validateConfig from '../utils/validate-config';
import { FabConfig } from './config.type';

class EnvironmentVariablesValidator {
  @IsUrl()
  FAB_TOKEN_URL: string;

  @IsUrl()
  FAB_PAYMENT_URL: string;

  @IsString()
  FAB_CLIENT_ID: string;

  @IsString()
  FAB_CLIENT_ASSERTION: string;

  @IsString()
  FAB_AES_KEY: string;

  @IsString()
  FAB_CHANNEL_ID: string;

  @IsOptional()
  @IsUrl()
  FAB_ACCOUNT_INFO_URL?: string;

  @IsString()
  FAB_TXN_TOKEN_SECRET: string;
}

export default registerAs<FabConfig>('fab', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    tokenUrl: process.env.FAB_TOKEN_URL!,
    paymentUrl: process.env.FAB_PAYMENT_URL!,
    clientId: process.env.FAB_CLIENT_ID!,
    clientAssertion: process.env.FAB_CLIENT_ASSERTION!,
    aesKey: process.env.FAB_AES_KEY!,
    channelId: process.env.FAB_CHANNEL_ID!,
    accountInfoUrl: process.env.FAB_ACCOUNT_INFO_URL,
    txnTokenSecret: process.env.FAB_TXN_TOKEN_SECRET!,
  };
});
