import { Module } from '@nestjs/common';
import { DNFSUsermanagementService } from './dfns-user-management.service';
import { DNFSUsermanagementController } from './dfns-user-management.controller';
import { WalletService } from 'src/wallet/wallet.service';
@Module({
  imports: [],
  controllers: [DNFSUsermanagementController],
  providers: [DNFSUsermanagementService, WalletService],
  exports: [DNFSUsermanagementService],
})
export class DNFSUsermanagementModule {}
