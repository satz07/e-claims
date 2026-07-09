import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserKyc } from 'src/database/entities/user-kyc.entity';
import { KYCService } from './user-kyc.service';
import { KYCController } from './user-kyc.controller';
import { User } from 'src/database/entities/users.entity';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserKyc, User]), MailModule],
  controllers: [KYCController],
  providers: [KYCService],
  exports: [KYCService],
})
export class KYCModule {}
