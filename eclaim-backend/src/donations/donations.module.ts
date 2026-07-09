import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';
import { Donations } from '../database/entities/donations.entity';
import { User } from '../database/entities/users.entity';
import { DONATION_GATEWAY } from './donations.gateway';
import { MockDonationGateway } from './mock-donation.gateway';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Donations, User]),
    forwardRef(() => WalletModule),
  ],
  controllers: [DonationsController],
  providers: [
    DonationsService,
    {
      provide: DONATION_GATEWAY,
      useClass: MockDonationGateway, // Swap to LiveDonationGateway when ready to integrate
    },
  ],
  exports: [DonationsService],
})
export class DonationsModule {}
