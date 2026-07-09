import { registerAs } from '@nestjs/config';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumberString,
  IsString,
} from 'class-validator';
import validateConfig from 'src/utils/validate-config';
import { DfnsConfig } from './config.type';

class EnvironmentVariablesValidator {
  @IsString()
  @IsNotEmpty()
  DFNS_APP_ID: string;

  @IsString()
  @IsNotEmpty()
  DFNS_ORG_ID: string;

  @IsString()
  @IsNotEmpty()
  DFNS_ORG_EMAIL: string;

  @IsString()
  @IsNotEmpty()
  DFNS_BASE_URL: string;

  @IsString()
  @IsNotEmpty()
  DFNS_AUTH_TOKEN: string;

  @IsString()
  @IsNotEmpty()
  DFNS_CREDENTIAL_ID: string;

  @IsString()
  @IsNotEmpty()
  DFNS_PRIVATE_KEY: string;

  @IsString()
  @IsNotEmpty()
  DFNS_RP_ID: string;

  @IsString()
  @IsNotEmpty()
  DFNS_RP_NAME: string;

  @IsString()
  @IsNotEmpty()
  DFNS_PERMISSION_ID: string;

  @IsString()
  @IsNotEmpty()
  DFNS_PERMISSION_NAME: string;

  @IsBoolean()
  DFNS_ENFORCE_END_USER_WALLETS: boolean;

  @IsString()
  @IsNotEmpty()
  DFNS_TOKEN_CONTRACT: string;

  @IsString()
  @IsNotEmpty()
  DFNS_NETWORK: string;

  @IsNumberString()
  DFNS_TOKEN_DECIMALS: string;
}

function normalizePem(v?: string) {
  if (!v) return '';

  const unquoted = v.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');

  return unquoted.replace(/\\n/g, '\n').trim();
}

export default registerAs<DfnsConfig>('dfns', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  const privateKey = normalizePem(process.env.DFNS_PRIVATE_KEY);

  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('DFNS_PRIVATE_KEY does not look like a PEM private key');
  }

  return {
    appId: process.env.DFNS_APP_ID as string,
    orgId: process.env.DFNS_ORG_ID as string,
    orgEmail: process.env.DFNS_ORG_EMAIL as string,
    baseUrl: process.env.DFNS_BASE_URL as string,
    authToken: process.env.DFNS_AUTH_TOKEN as string,
    serviceAccountCredentialId: process.env.DFNS_CREDENTIAL_ID as string,
    serviceAccountPrivateKey: privateKey,
    rpId: process.env.DFNS_RP_ID as string,
    rpName: process.env.DFNS_RP_NAME as string,
    defaultPermissionId: process.env.DFNS_PERMISSION_ID as string,
    defaultPermissionName: process.env.DFNS_PERMISSION_NAME as string,
    enforceEndUserWallets:
      String(process.env.DFNS_ENFORCE_END_USER_WALLETS).toLowerCase() ===
      'true',
    ddscTokenContract: process.env.DFNS_TOKEN_CONTRACT as string,
    ddscTokenDecimals: Number(process.env.DFNS_TOKEN_DECIMALS),
    network: process.env.DFNS_NETWORK as string,
  };
});
