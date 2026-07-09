import { registerAs } from '@nestjs/config';
import { KeycloakConfig } from './config.type';
import { IsNotEmpty, IsString } from 'class-validator';
import validateConfig from 'src/utils/validate-config';

class EnvironmentVariablesValidator {
  @IsString()
  @IsNotEmpty()
  REALM: string;

  @IsString()
  @IsNotEmpty()
  CLIENT_ID: string;

  @IsString()
  @IsNotEmpty()
  CLIENT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  CLIENT_SCOPE: string;

  @IsString()
  @IsNotEmpty()
  KEYCLOAK_URL: string;
}

export default registerAs<KeycloakConfig>('keycloak', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    realm: process.env.REALM,
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    client_scope: process.env.CLIENT_SCOPE,
    keycloak_url: process.env.KEYCLOAK_URL,
  };
});
