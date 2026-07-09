import { Module } from '@nestjs/common';
import { CryptoPriceController } from './crypto-price.controller';
import { CryptoPriceService } from './crypto-price.service';
import { WalletModule } from 'src/wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [CryptoPriceController],
  providers: [CryptoPriceService],
  exports: [CryptoPriceService],
})
export class CryptoPriceModule {}
