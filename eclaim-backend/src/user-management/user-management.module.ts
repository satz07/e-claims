// src/modules/user-management/user-management.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/database/entities/users.entity';
import { UserManagementService } from './user-management.service';
import { UserManagementController } from './user-management.controller';
import { MailModule } from 'src/mail/mail.module';
import { UserPasskey } from 'src/database/entities/user-passkey.entity';
import { UserKyc } from 'src/database/entities/user-kyc.entity';
import { WalletService } from 'src/wallet/wallet.service';
import { KYCService } from 'src/user-kyc/user-kyc.service';
import { UserTwoFactor } from 'src/database/entities/user-two-factor.entity';
import { TwoFactorService } from './two-factor.service';
import { UserKeycloak } from 'src/database/entities/userkeycloak.entity';
import { KeycloakService } from 'src/keycloak/keycloak.service';
import { Wallet } from 'src/database/entities/wallet.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserPasskey,
      UserKyc,
      UserTwoFactor,
      UserKeycloak,
      Wallet,
    ]),
    MailModule,
  ],
  providers: [
    UserManagementService,
    TwoFactorService,
    WalletService,
    KYCService,
    KeycloakService,
  ],
  controllers: [UserManagementController],
  exports: [UserManagementService],
})
export class UserManagementModule {}
