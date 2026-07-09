import { registerAs } from '@nestjs/config';
import { IsString } from 'class-validator';
import validateConfig from 'src/utils/validate-config';
import { WebAuthnConfig } from './config.type';

class EnvironmentVariablesValidator {
  @IsString()
  WEBAUTHN_RP_NAME: string;

  @IsString()
  WEBAUTHN_ALLOWED_ORIGIN: string;

  @IsString()
  WEBAUTHN_ALLOWED_RPID: string;
}

function parseCsv(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default registerAs<WebAuthnConfig>('webauthn', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    rpName: process.env.WEBAUTHN_RP_NAME,
    allowedOrigin: parseCsv(process.env.WEBAUTHN_ALLOWED_ORIGIN),
    allowedRpID: parseCsv(process.env.WEBAUTHN_ALLOWED_RPID),
  };
});
