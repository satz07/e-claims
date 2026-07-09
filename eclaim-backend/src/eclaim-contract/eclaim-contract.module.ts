import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EclaimContractService } from './eclaim-contract.service';
import { EclaimContractController } from './eclaim-contract.controller';
import { ProviderRegistryService } from './provider-registry.service';
import { ProviderRegistryController } from './provider-registry.controller';
import { VerifiableRegistryService } from './verifiable-registry.service';
import {
  CitizenRegistryController,
  ClinicianRegistryController,
  InsurerRegistryController,
} from './registry-controllers';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';

@Module({
  imports: [ConfigModule],
  providers: [
    EclaimContractService,
    ProviderRegistryService,
    VerifiableRegistryService,
    IntegrationService,
  ],
  controllers: [
    ProviderRegistryController,
    EclaimContractController,
    CitizenRegistryController,
    ClinicianRegistryController,
    InsurerRegistryController,
    IntegrationController,
  ],
  exports: [
    EclaimContractService,
    ProviderRegistryService,
    VerifiableRegistryService,
    IntegrationService,
  ],
})
export class EclaimContractModule {}
