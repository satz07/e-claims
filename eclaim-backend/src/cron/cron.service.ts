import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UserManagementService } from 'src/user-management/user-management.service';

@Injectable()
export class CronService implements OnModuleInit {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly userManagementService: UserManagementService) {}

  onModuleInit() {
    this.logger.log('CronService initialized');
  }

  @Cron('*/10 * * * * *')
  async handleCron() {
    this.logger.log('Cron job running every 10 seconds');

    try {
      const result =
        await this.userManagementService.processPendingKeycloakUsers();

      this.logger.log(
        `Keycloak cron done. processed=${result.processed}, success=${result.success}, failed=${result.failed}`,
      );
    } catch (error) {
      this.logger.error(
        'Cron job failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
