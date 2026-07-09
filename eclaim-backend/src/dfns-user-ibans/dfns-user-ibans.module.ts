import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserIban } from 'src/database/entities/dfns-user-iban.entity';
import { UserIbanController } from './dfns-user-ibans.controller';
import { UserIbanService } from './dfns-user-ibans.service';
import { UserKyc } from 'src/database/entities/user-kyc.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserIban, UserKyc])],
  controllers: [UserIbanController],
  providers: [UserIbanService],
  exports: [UserIbanService],
})
export class UserIbanModule {}
