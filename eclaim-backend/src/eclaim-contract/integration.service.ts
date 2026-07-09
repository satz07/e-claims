import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { EclaimContractService } from './eclaim-contract.service';
import { ProviderRegistryService } from './provider-registry.service';
import { VerifiableRegistryService } from './verifiable-registry.service';

const RPC_URL = process.env.SPEARHEAD_RPC_URL || 'https://rpc.spearhead.adifoundation.ai';

const DEMO = {
  providerId: 'FID-35-108719-7',
  providerName: 'ST. LEONARDS HOSPITAL',
  level: 'LEVEL 4',
  county: 'NAIROBI',
  facilityType: 'hospital',
  crId: 'CR3248022528592-4',
  schemeCode: 'CAT-SHA-001',
  clinicianId: 'CMP-DEMO-001',
  clinicianFacilityFid: 'FID-35-108719-7',
};

@Injectable()
export class IntegrationService {
  constructor(
    private readonly claims: EclaimContractService,
    private readonly providers: ProviderRegistryService,
    private readonly registries: VerifiableRegistryService,
  ) {}

  async getHealth() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const blockNumber = await provider.getBlockNumber();
    const deployment = await this.claims.getDeploymentInfo();

    return {
      status: 'ok',
      blockNumber,
      chainId: deployment.chainId,
      contracts: {
        claimRegistry: deployment.claimRegistryAddress,
        providerRegistry: deployment.providerRegistryAddress,
        citizenRegistry: this.registries.addressFor('citizen'),
        clinicianRegistry: this.registries.addressFor('clinician'),
        insurerRegistry: this.registries.addressFor('insurer'),
      },
      registriesConfigured: {
        citizen: this.registries.isConfigured('citizen'),
        clinician: this.registries.isConfigured('clinician'),
        insurer: this.registries.isConfigured('insurer'),
      },
      adiDeliverables: {
        baseInfrastructure: 'integrated (Spearhead RPC + NestJS)',
        identityAndTerminology: 'FHIR parser + external terminology URLs in bundles',
        verifiableRegistries: 'facility + citizen + clinician + insurer (hash-only)',
        eClaimPlatform: 'FHIR submit → ClaimRegistry anchor',
        contractingModules: 'not in scope (items d–e pending Apeiro)',
      },
    };
  }

  async seedDemoRegistries() {
    const licenseFrom = '2024-01-01';
    const licenseTo = '2030-12-31';
    const results: Record<string, unknown> = {};

    try {
      const exists = await this.providers.getProvider(DEMO.providerId).catch(() => null);
      if (!exists) {
        results.provider = await this.providers.registerProvider({
          providerId: DEMO.providerId,
          name: DEMO.providerName,
          level: DEMO.level,
          county: DEMO.county,
          facilityType: DEMO.facilityType,
          licenseValidFrom: licenseFrom,
          licenseValidTo: licenseTo,
        });
      } else {
        results.provider = { skipped: true, providerId: DEMO.providerId };
      }
    } catch (e: any) {
      results.provider = { error: e?.message || 'provider seed failed' };
    }

    for (const [kind, id, meta] of [
      ['citizen', DEMO.crId, ''] as const,
      ['insurer', DEMO.schemeCode, ''] as const,
      ['clinician', DEMO.clinicianId, DEMO.clinicianFacilityFid] as const,
    ]) {
      if (!this.registries.isConfigured(kind)) {
        results[kind] = { skipped: true, reason: 'not configured' };
        continue;
      }
      try {
        const exists = await this.registries.exists(kind, id);
        if (!exists) {
          results[kind] = await this.registries.register(kind, {
            id,
            meta,
            validFrom: licenseFrom,
            validTo: licenseTo,
          });
        } else {
          results[kind] = { skipped: true, id };
        }
      } catch (e: any) {
        results[kind] = { error: e?.message || `${kind} seed failed` };
      }
    }

    return { ok: true, demo: DEMO, results };
  }
}
