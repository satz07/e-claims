// src/modules/fab-integration/fab-integration.module.ts
import { Module } from '@nestjs/common';
import { FabIntegrationController } from './fab-integration.controller';
import { FabIntegrationService } from './fab-integration.service';
import { FabCryptoService } from './fab-crypto.service';
import { SharedServiceModule } from 'src/SharedService/sharedservice.module';

@Module({
  controllers: [FabIntegrationController],
  providers: [FabIntegrationService, FabCryptoService],
  exports: [FabIntegrationService],
  imports: [SharedServiceModule],
})
export class FabIntegrationModule {}
