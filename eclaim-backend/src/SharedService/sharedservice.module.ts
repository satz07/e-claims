import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SharedActivityLogService } from './activitylog.shared.service';
import { ConfigModule } from '@nestjs/config';
import { SharedBatchService } from './batch.shared.service';
import { CryptoService } from './crypto.shared';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [SharedActivityLogService, SharedBatchService, CryptoService],
  exports: [SharedActivityLogService, SharedBatchService, CryptoService],
})
export class SharedServiceModule {}
