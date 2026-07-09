import { registerAs } from '@nestjs/config';
import { AuthConfig } from './config.type';
import { IsOptional, IsString } from 'class-validator';
import validateConfig from '../utils/validate-config';

class EnvironmentVariablesValidator {
  @IsString()
  JWT_ALG: string;

  @IsString()
  JWT_ISSUER: string;

  @IsString()
  JWT_AUDIENCE: string;

  @IsString()
  JWT_EXPIRES: string;

  @IsOptional()
  @IsString()
  JWT_KID?: string;

  @IsString()
  JWT_PRIVATE_KEY: string;

  @IsString()
  JWT_PUBLIC_KEY: string;

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_REFRESH_EXPIRES: string;
}

function normalizePem(v?: string) {
  if (!v) return '';
  // remove wrapping quotes if they got included in the value
  const unquoted = v.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  // convert literal \n sequences into real newlines
  return unquoted.replace(/\\n/g, '\n').trim();
}

export default registerAs<AuthConfig>('auth', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  const alg = process.env.JWT_ALG?.trim() || 'RS256';

  if (alg !== 'RS256') {
    throw new Error(`JWT_ALG must be RS256 (received: ${alg})`);
  }

  const privateKey = normalizePem(process.env.JWT_PRIVATE_KEY);
  const publicKey = normalizePem(process.env.JWT_PUBLIC_KEY);

  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('JWT_PRIVATE_KEY does not look like a PEM private key');
  }
  if (!publicKey.includes('-----BEGIN PUBLIC KEY-----')) {
    throw new Error('JWT_PUBLIC_KEY does not look like a PEM public key');
  }

  return {
    alg,
    kid: process.env.JWT_KID,
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
    expires: process.env.JWT_EXPIRES,
    privateKey,
    publicKey,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpires: process.env.JWT_REFRESH_EXPIRES,
  };
});
