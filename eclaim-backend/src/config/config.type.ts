export type AppConfig = {
  nodeEnv: string;
  name: string;
  workingDirectory: string;
  frontendDomain?: string;
  port: number;
  apiPrefix: string;
  fallbackLanguage: string;
  headerLanguage: string;
};

export type APPEndPointsConfig = {
  backend: {
    authUrl: string;
  };
};

export type RedisConfig = {
  host: string;
  password: string;
  port: number;
  ttl: number;
};

// src/config/sumsub/config.type.ts
export interface SumsubConfig {
  appToken: string;
  secretKey: string;
  rootUrl: string;
  levelName: string;
}

export type KeycloakConfig = {
  realm: string;
  client_id: string;
  client_secret: string;
  client_scope: string;
  keycloak_url: string;
};

export type AppleConfig = {
  appAudience: string[];
};

export type AuthConfig = {
  alg: 'RS256';
  kid?: string;
  issuer: string;
  audience: string;
  expires: string;
  privateKey: string;
  publicKey: string;
  refreshSecret: string;
  refreshExpires: string;
};

export type DatabaseConfig = {
  url?: string;
  type?: string;
  host?: string;
  port?: number;
  password?: string;
  name?: string;
  username?: string;
  synchronize?: boolean;
  maxConnections: number;
  sslEnabled?: boolean;
  rejectUnauthorized?: boolean;
  ca?: string;
  key?: string;
  cert?: string;
};

export type FacebookConfig = {
  appId?: string;
  appSecret?: string;
};

export type FileConfig = {
  driver: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  awsDefaultS3Bucket?: string;
  awsDefaultS3Url?: string;
  awsS3Region?: string;
  maxFileSize: number;
};

export type GoogleConfig = {
  clientId?: string;
  clientSecret?: string;
};

export type MailConfig = {
  port: number;
  host?: string;
  user?: string;
  password?: string;
  defaultEmail?: string;
  defaultName?: string;
  ignoreTLS: boolean;
  secure: boolean;
  requireTLS: boolean;
};

export type TwitterConfig = {
  consumerKey?: string;
  consumerSecret?: string;
};

export interface FabConfig {
  tokenUrl: string;
  paymentUrl: string;
  clientId: string;
  clientAssertion: string;
  aesKey: string;
  channelId: string;
  accountInfoUrl: string;
  txnTokenSecret: string;
}

export type WebAuthnConfig = {
  rpName: string;
  allowedOrigin: string[];
  allowedRpID: string[];
};

export type DtpsConfig = {
  base_url: string;
  secret_key: string;
  api_key: string;
};

export type DfnsConfig = {
  appId: string;
  orgId: string;
  orgEmail: string;
  baseUrl: string;
  authToken: string;
  serviceAccountCredentialId: string;
  serviceAccountPrivateKey: string;
  rpId: string;
  rpName: string;
  defaultPermissionId: string;
  defaultPermissionName: string;
  enforceEndUserWallets: boolean;
  ddscTokenContract: string;
  ddscTokenDecimals: number;
};

export type AllConfigType = {
  app: AppConfig;
  apple: AppleConfig;
  auth: AuthConfig;
  database: DatabaseConfig;
  facebook: FacebookConfig;
  file: FileConfig;
  google: GoogleConfig;
  twitter: TwitterConfig;
  fab: FabConfig;
  redis: RedisConfig;
  sumsub: SumsubConfig;
  mail: MailConfig;
  keycloak: KeycloakConfig;
  webauthn: WebAuthnConfig;
  dtps: DtpsConfig;
  dfns: DfnsConfig;
};
