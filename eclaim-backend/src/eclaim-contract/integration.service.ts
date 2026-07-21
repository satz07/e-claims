import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { randomUUID } from 'crypto';
import { EclaimContractService } from './eclaim-contract.service';
import { ProviderRegistryService } from './provider-registry.service';
import { VerifiableRegistryService } from './verifiable-registry.service';
import { getActiveChain } from './chain-config';

const RPC_URL = getActiveChain().rpcUrl;

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

const COUNTIES = ['NAIROBI', 'MOMBASA', 'KISUMU', 'NAKURU', 'KIAMBU'];
const LEVELS = ['LEVEL 2', 'LEVEL 3', 'LEVEL 4', 'LEVEL 5', 'LEVEL 6'];
const HOSPITALS = [
  'ST. LEONARDS HOSPITAL',
  'KAREN MEDICAL CENTRE',
  'WESTLANDS CLINIC',
  'THIKA GENERAL HOSPITAL',
  'MOMBASA COAST HOSPITAL',
];

function pad(n: number) {
  return String(n).padStart(3, '0');
}

function buildMinimalFhirBundle(opts: {
  use: 'claim' | 'preauthorization';
  claimId: string;
  fid: string;
  facilityName: string;
  level: string;
  crId: string;
  schemeCode: string;
  amount: number;
}) {
  const bundleId = randomUUID();
  return {
    resourceType: 'Bundle',
    id: bundleId,
    type: 'message',
    entry: [
      {
        resource: {
          resourceType: 'Organization',
          id: opts.fid,
          name: opts.facilityName,
          extension: [
            {
              url: 'https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/facility-level',
              valueCodeableConcept: { coding: [{ code: opts.level }] },
            },
          ],
        },
      },
      {
        resource: {
          resourceType: 'Coverage',
          extension: [
            { url: 'schemeCategoryCode', valueString: opts.schemeCode },
          ],
        },
      },
      {
        resource: {
          resourceType: 'Patient',
          id: opts.crId,
          identifier: [{ system: 'nationalid', value: `NID-${opts.crId}` }],
        },
      },
      {
        resource: {
          resourceType: 'Claim',
          use: opts.use,
          identifier: [
            {
              system: 'https://qa-mis.apeiro-digital.com/fhir/claim',
              value: opts.claimId,
            },
          ],
          type: { coding: [{ code: 'institutional' }] },
          subType: { coding: [{ code: 'ip' }] },
          total: { value: opts.amount, currency: 'KES' },
          billablePeriod: {
            start: '2026-03-27T03:59:22+03:00',
            end: '2026-03-29T17:00:47+03:00',
          },
          created: '2024-12-03',
          provider: { reference: `Organization/${opts.fid}` },
          patient: { reference: `Patient/${opts.crId}` },
          item: [
            {
              productOrService: {
                coding: [
                  { code: 'PMF-12-001', display: 'palliative care' },
                ],
              },
            },
          ],
        },
      },
    ],
  };
}

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

  /**
   * Seed 5 providers + 5 citizens + 5 clinicians + 5 insurers,
   * then for each provider submit 5 claims + 5 preauthorizations (50 total).
   * Uses OWNER_PRIVATE_KEY. Registries are idempotent; claims always new UUIDs.
   */
  async seedBulkDemo() {
    const licenseFrom = '2024-01-01';
    const licenseTo = '2030-12-31';
    const n = 5;
    const claimsPerProvider = 5;
    const preauthsPerProvider = 5;

    const entities = Array.from({ length: n }, (_, i) => {
      const idx = i + 1;
      if (idx === 1) {
        return {
          providerId: DEMO.providerId,
          providerName: DEMO.providerName,
          level: DEMO.level,
          county: DEMO.county,
          crId: DEMO.crId,
          schemeCode: DEMO.schemeCode,
          clinicianId: DEMO.clinicianId,
        };
      }
      return {
        providerId: `FID-DEMO-${pad(idx)}`,
        providerName: HOSPITALS[i] || `DEMO HOSPITAL ${idx}`,
        level: LEVELS[i] || 'LEVEL 4',
        county: COUNTIES[i] || 'NAIROBI',
        crId: `CR-DEMO-${pad(idx)}`,
        schemeCode: `CAT-DEMO-${pad(idx)}`,
        clinicianId: `CMP-DEMO-${pad(idx)}`,
      };
    });

    const registryResults: Record<string, unknown>[] = [];

    for (const e of entities) {
      try {
        const exists = await this.providers.getProvider(e.providerId).catch(() => null);
        if (!exists) {
          registryResults.push({
            kind: 'provider',
            ...(await this.providers.registerProvider({
              providerId: e.providerId,
              name: e.providerName,
              level: e.level,
              county: e.county,
              facilityType: 'hospital',
              licenseValidFrom: licenseFrom,
              licenseValidTo: licenseTo,
            })),
          });
        } else {
          registryResults.push({ kind: 'provider', skipped: true, id: e.providerId });
        }
      } catch (err: any) {
        registryResults.push({
          kind: 'provider',
          id: e.providerId,
          error: err?.message || 'register failed',
        });
      }

      for (const [kind, id, meta] of [
        ['citizen', e.crId, ''] as const,
        ['insurer', e.schemeCode, ''] as const,
        ['clinician', e.clinicianId, e.providerId] as const,
      ]) {
        if (!this.registries.isConfigured(kind)) {
          registryResults.push({ kind, skipped: true, reason: 'not configured', id });
          continue;
        }
        try {
          const exists = await this.registries.exists(kind, id);
          if (!exists) {
            registryResults.push({
              kind,
              ...(await this.registries.register(kind, {
                id,
                meta,
                validFrom: licenseFrom,
                validTo: licenseTo,
              })),
            });
          } else {
            registryResults.push({ kind, skipped: true, id });
          }
        } catch (err: any) {
          registryResults.push({
            kind,
            id,
            error: err?.message || 'register failed',
          });
        }
      }
    }

    const claimResults: Record<string, unknown>[] = [];
    let claimOk = 0;
    let preauthOk = 0;

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      for (let c = 1; c <= claimsPerProvider; c++) {
        const claimId = randomUUID();
        try {
          const bundle = buildMinimalFhirBundle({
            use: 'claim',
            claimId,
            fid: e.providerId,
            facilityName: e.providerName,
            level: e.level,
            crId: e.crId,
            schemeCode: e.schemeCode,
            amount: 5000 + c * 1000 + i * 100,
          });
          const res = await this.claims.submitFhirBundle(bundle);
          claimResults.push({ type: 'claim', providerId: e.providerId, ...res });
          claimOk++;
        } catch (err: any) {
          claimResults.push({
            type: 'claim',
            providerId: e.providerId,
            claimId,
            error: err?.message || 'submit failed',
          });
        }
      }

      for (let p = 1; p <= preauthsPerProvider; p++) {
        const claimId = randomUUID();
        try {
          const bundle = buildMinimalFhirBundle({
            use: 'preauthorization',
            claimId,
            fid: e.providerId,
            facilityName: e.providerName,
            level: e.level,
            crId: e.crId,
            schemeCode: e.schemeCode,
            amount: 3000 + p * 500 + i * 50,
          });
          const res = await this.claims.submitFhirBundle(bundle);
          claimResults.push({
            type: 'preauthorization',
            providerId: e.providerId,
            ...res,
          });
          preauthOk++;
        } catch (err: any) {
          claimResults.push({
            type: 'preauthorization',
            providerId: e.providerId,
            claimId,
            error: err?.message || 'submit failed',
          });
        }
      }
    }

    return {
      ok: true,
      network: getActiveChain().key,
      plan: {
        providers: n,
        citizens: n,
        clinicians: n,
        insurers: n,
        claims: n * claimsPerProvider,
        preauthorizations: n * preauthsPerProvider,
        totalAnchors: n * (claimsPerProvider + preauthsPerProvider),
      },
      entities,
      summary: {
        registries: registryResults.length,
        registryErrors: registryResults.filter((r) => 'error' in r).length,
        claimsOk: claimOk,
        preauthsOk: preauthOk,
        claimErrors: claimResults.filter((r) => 'error' in r).length,
      },
      registryResults,
      claimResults,
    };
  }

  /** Create N more claim/preauth anchors randomly across the 5 demo facilities. */
  async seedRandomAnchors(count = 45) {
    const n = Math.min(200, Math.max(1, Number(count) || 45));
    const entities = Array.from({ length: 5 }, (_, i) => {
      const idx = i + 1;
      if (idx === 1) {
        return {
          providerId: DEMO.providerId,
          providerName: DEMO.providerName,
          level: DEMO.level,
          crId: DEMO.crId,
          schemeCode: DEMO.schemeCode,
        };
      }
      return {
        providerId: `FID-DEMO-${pad(idx)}`,
        providerName: HOSPITALS[i] || `DEMO HOSPITAL ${idx}`,
        level: LEVELS[i] || 'LEVEL 4',
        crId: `CR-DEMO-${pad(idx)}`,
        schemeCode: `CAT-DEMO-${pad(idx)}`,
      };
    });

    const results: Record<string, unknown>[] = [];
    let claimOk = 0;
    let preauthOk = 0;

    for (let i = 0; i < n; i++) {
      const e = entities[Math.floor(Math.random() * entities.length)];
      const use: 'claim' | 'preauthorization' =
        Math.random() < 0.5 ? 'claim' : 'preauthorization';
      const claimId = randomUUID();
      const amount = 2000 + Math.floor(Math.random() * 18000);
      try {
        const bundle = buildMinimalFhirBundle({
          use,
          claimId,
          fid: e.providerId,
          facilityName: e.providerName,
          level: e.level,
          crId: e.crId,
          schemeCode: e.schemeCode,
          amount,
        });
        const res = await this.claims.submitFhirBundle(bundle);
        results.push({ type: use, providerId: e.providerId, ...res });
        if (use === 'claim') claimOk++;
        else preauthOk++;
      } catch (err: any) {
        results.push({
          type: use,
          providerId: e.providerId,
          claimId,
          error: err?.message || 'submit failed',
        });
      }
    }

    return {
      ok: true,
      network: getActiveChain().key,
      requested: n,
      summary: {
        claimsOk: claimOk,
        preauthsOk: preauthOk,
        errors: results.filter((r) => 'error' in r).length,
      },
      results,
    };
  }
}
