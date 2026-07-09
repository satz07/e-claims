import { Module } from '@nestjs/common';
import { WalletController, WellKnownController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserKyc } from 'src/database/entities/user-kyc.entity';
import { Wallet } from 'src/database/entities/wallet.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserKyc, Wallet])],
  controllers: [WalletController, WellKnownController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
