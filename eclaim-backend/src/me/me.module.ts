// src/modules/bank-info/bank-info.module.ts
import { Module } from '@nestjs/common';
import { MeService } from './me.service';
import { MeController } from './me.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/database/entities/users.entity';
import { UserKyc } from 'src/database/entities/user-kyc.entity';
import { UserBank } from 'src/database/entities/user-bank.entity';
import { Wallet } from 'src/database/entities/wallet.entity';
import { WalletModule } from 'src/wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserKyc, UserBank, Wallet]),
    WalletModule,
  ],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
