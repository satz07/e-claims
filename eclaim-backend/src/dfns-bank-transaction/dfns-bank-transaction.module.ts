// src/modules/bank-transaction/bank-transaction.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankTransaction } from 'src/database/entities/bank-transaction.entity';
import { UserKyc } from 'src/database/entities/user-kyc.entity';
import { BankTransactionService } from './dfns-bank-transaction.service';
import { BankTransactionController } from './dfns-bank-transaction.controller';
import { UserBank } from 'src/database/entities/user-bank.entity';
import { WalletModule } from 'src/wallet/wallet.module';
import { User } from 'src/database/entities/users.entity';
import { Wallet } from 'src/database/entities/wallet.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([BankTransaction, UserBank, UserKyc, User, Wallet]),
    WalletModule,
  ],
  providers: [BankTransactionService],
  controllers: [BankTransactionController],
})
export class BankTransactionModule {}
