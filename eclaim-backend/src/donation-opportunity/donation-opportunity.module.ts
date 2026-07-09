import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DonationOpportunityController } from './donation-opportunity.controller';
import { DonationOpportunityService } from './donation-opportunity.service';
import { DonationOpportunity } from '../database/entities/donation-opportunity.entity';
import { ProjectPlan } from '../database/entities/project-plan.entity';
import { Beneficiary } from '../database/entities/beneficiary.entity';
import { Milestone } from '../database/entities/milestone.entity';
import { Attachment } from '../database/entities/attachment.entity';
import { UserKyc } from '../database/entities/user-kyc.entity';
import { Donations } from '../database/entities/donations.entity';
import { Disbursement } from '../database/entities/disbursement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DonationOpportunity,
      ProjectPlan,
      Beneficiary,
      Milestone,
      Attachment,
      UserKyc,
      Donations,
      Disbursement,
    ]),
  ],
  controllers: [DonationOpportunityController],
  providers: [DonationOpportunityService],
  exports: [DonationOpportunityService],
})
export class DonationOpportunityModule {}
