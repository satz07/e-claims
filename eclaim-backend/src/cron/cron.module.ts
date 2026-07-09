import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { UserManagementModule } from 'src/user-management/user-management.module';

@Module({
  imports: [UserManagementModule],
  providers: [CronService],
})
export class CronModule {}
