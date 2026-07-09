// src/modules/bank-info/bank-info.module.ts
import { Module } from '@nestjs/common';
import { BankInfoController } from './dfns-bank-info.controller';
import { BankInfoService } from './dfns-bank-info.service';

@Module({
  controllers: [BankInfoController],
  providers: [BankInfoService],
})
export class BankInfoModule {}
