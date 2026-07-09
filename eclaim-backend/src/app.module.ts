import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import * as Joi from '@hapi/joi';
import { DatabaseModule } from './database/database.module';
import authConfig from './config/auth.config';
import appConfig from './config/app.config';
import redisConfig from './config/redis.config';
import fileConfig from './config/file.config';
import facebookConfig from './config/facebook.config';
import googleConfig from './config/google.config';
import twitterConfig from './config/twitter.config';
import appleConfig from './config/apple.config';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { GlobalHttpModule } from './common/globalModule/global-http.module';
import { RedisModule } from './redis/redis.module';
import appendpointsConfig from './config/appendpoints.config';
import { SharedServiceModule } from './SharedService/sharedservice.module';
import { WalletModule } from './wallet/wallet.module';
// import { DNFSUsermanagementModule } from './dfns-user-management/dfns-user-management.module';
import { KYCModule } from './user-kyc/user-kyc.module';
import { UserIbanModule } from './dfns-user-ibans/dfns-user-ibans.module';
import { BankInfoModule } from './dfns-bank-info/dfns-bank-info.module';
import { UserBankModule } from './dfns-user-bank/dfns-user-bank.module';
import { BankTransactionModule } from './dfns-bank-transaction/dfns-bank-transaction.module';
import { AuthModule } from './auth/auth.module';
import fabConfig from './config/fab.config';
// import { FabIntegrationModule } from './fab-integration/fab-integration.module';
import sumsubConfig from './config/sumsub.config';
import { MeModule } from './me/me.module';
import keycloakConfig from './config/keycloak.config';
import { KeycloakModule } from './keycloak/keycloak.module';
import mailConfig from './config/mail.config';
import { UserManagementModule } from './user-management/user-management.module';
import webauthConfig from './config/webauth.config';
import type { Algorithm } from 'jsonwebtoken';
import { CryptoPriceModule } from './crypto-price/crypto-price.module';
import dtpsConfig from './config/dtps.config';
import { DtpsModule } from './dtps-cards/dtps-cards.module';
import { DonationOpportunityModule } from './donation-opportunity/donation-opportunity.module';
import dfnsConfig from './config/dfns.config';
import { CampaignsModule } from './campaigns/campaigns.module';
import { DonationsModule } from './donations/donations.module';
import { DisbursementsModule } from './disbursements/disbursements.module';
import { EclaimContractModule } from './eclaim-contract/eclaim-contract.module';
// import { ScheduleModule } from '@nestjs/schedule';
// import { CronModule } from './cron/cron.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        POSTGRES_HOST: Joi.string().required(),
        POSTGRES_PORT: Joi.number().required(),
        POSTGRES_USER: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_DB: Joi.string().required(),
        PORT: Joi.number(),
      }),
      isGlobal: true,
      load: [
        authConfig,
        appConfig,
        fileConfig,
        facebookConfig,
        googleConfig,
        twitterConfig,
        appleConfig,
        redisConfig,
        appendpointsConfig,
        fabConfig,
        sumsubConfig,
        keycloakConfig,
        mailConfig,
        webauthConfig,
        dtpsConfig,
        dfnsConfig,
      ],
      envFilePath: ['.env'],
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const alg = (config.get<string>('auth.alg', { infer: true }) ??
          'RS256') as Algorithm;

        const issuer = config.get<string>('auth.issuer', { infer: true })!;
        const audience = config.get<string>('auth.audience', { infer: true })!;
        const expiresIn =
          config.get<string | number>('auth.expires', { infer: true }) ?? '15m';

        const privateKey = config.get<string>('auth.privateKey', {
          infer: true,
        })!;
        const publicKey = config.get<string>('auth.publicKey', {
          infer: true,
        })!;
        const kid = config.get<string>('auth.kid', { infer: true });

        return {
          privateKey,
          publicKey,
          signOptions: {
            algorithm: alg,
            expiresIn,
            issuer,
            audience,
            keyid: kid || undefined,
          },
          verifyOptions: {
            algorithms: [alg],
            issuer,
            audience,
          },
        };
      },
      global: true,
    }),
    // ScheduleModule.forRoot(),
    // CronModule,
    DatabaseModule,
    GlobalHttpModule,
    RedisModule,
    SharedServiceModule,
    WalletModule,
    // DNFSUsermanagementModule,
    UserIbanModule,
    KYCModule,
    BankInfoModule,
    UserBankModule,
    BankTransactionModule,
    AuthModule,
    // FabIntegrationModule,
    CryptoPriceModule,
    MeModule,
    KeycloakModule,
    UserManagementModule,
    DtpsModule,
    DonationOpportunityModule,
    CampaignsModule,
    DonationsModule,
    DisbursementsModule,
    EclaimContractModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .exclude(
        '/',
        '/health',
        {
          path: 'public/(.*)',
          method: RequestMethod.ALL,
        },
        {
          path: 'fab/(.*)',
          method: RequestMethod.ALL,
        },
        {
          path: 'admin/(.*)',
          method: RequestMethod.ALL,
        },
        {
          path: 'kyc/(.*)',
          method: RequestMethod.ALL,
        },
        {
          path: '.well-known/(.*)',
          method: RequestMethod.ALL,
        },
        {
          path: 'api/.well-known/(.*)',
          method: RequestMethod.ALL,
        },
      )
      .forRoutes('*');
  }
}
