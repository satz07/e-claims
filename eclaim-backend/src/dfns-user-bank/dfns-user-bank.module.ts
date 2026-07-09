// src/modules/user-bank/user-bank.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserBankController } from './dfns-user-bank.controller';
import { UserBankService } from './dfns-user-bank.service';
import { UserBank } from 'src/database/entities/user-bank.entity';
import { UserKyc } from 'src/database/entities/user-kyc.entity';
import { WalletModule } from 'src/wallet/wallet.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserBank, UserKyc]), WalletModule],
  controllers: [UserBankController],
  providers: [UserBankService],
})
export class UserBankModule {}
