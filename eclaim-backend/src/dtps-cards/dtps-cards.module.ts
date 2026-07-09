import { Module } from '@nestjs/common';
import { DtpsService } from './dtps.cards.service';
import { DtpsController } from './dtps-cards.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/database/entities/users.entity';
import { UserKyc } from 'src/database/entities/user-kyc.entity';
import { UserDtps } from 'src/database/entities/user-dtps.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserKyc, UserDtps])],
  controllers: [DtpsController],
  providers: [DtpsService],
  exports: [DtpsService],
})
export class DtpsModule {}
