import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisbursementsController } from './disbursements.controller';
import { DisbursementsService } from './disbursements.service';
import { Disbursement } from '../database/entities/disbursement.entity';
import { Donations } from '../database/entities/donations.entity';
import { Milestone } from '../database/entities/milestone.entity';
import { DonationOpportunity } from '../database/entities/donation-opportunity.entity';
import { TransferHistory } from '../database/entities/transfer-history.entity';
import { User } from '../database/entities/users.entity';
import { UserKyc } from '../database/entities/user-kyc.entity';
import { SharedTransferHistoryDbService } from '../SharedService/transfer-history.shared.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Disbursement,
      Donations,
      Milestone,
      DonationOpportunity,
      TransferHistory,
      User,
      UserKyc,
    ]),
    WalletModule, // provides WalletService
  ],
  controllers: [DisbursementsController],
  providers: [DisbursementsService, SharedTransferHistoryDbService],
  exports: [DisbursementsService],
})
export class DisbursementsModule {}
