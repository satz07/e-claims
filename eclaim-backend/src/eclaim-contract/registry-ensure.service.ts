import { BadRequestException, Injectable } from '@nestjs/common';
import { parseFhirBundle, ParsedFhirBundle } from './fhir-bundle.parser';
import { ClaimDbService } from './claim-db.service';
import { ProviderRegistryService } from './provider-registry.service';
import { VerifiableRegistryService } from './verifiable-registry.service';

const LICENSE_FROM = process.env.REGISTRY_LICENSE_FROM || '2010-01-01';
const LICENSE_TO = process.env.REGISTRY_LICENSE_TO || '2035-12-31';

export type EnsureAction =
  | 'none'
  | 'registered'
  | 'license_updated'
  | 'deregistered_and_registered'
  | 'skipped'
  | 'failed';

export interface EnsureEntityResult {
  id: string;
  authorized: boolean;
  action: EnsureAction;
  txHash?: string | null;
  alreadyRegistered?: boolean;
  source?: 'on-chain' | 'db' | 'bundle' | 'request' | 'minimal';
  configured?: boolean;
  error?: string;
}

export interface EnsureRegistriesResult {
  ok: boolean;
  fid: string;
  crId: string;
  schemeCode: string;
  atTime: number;
  claimDbConfigured: boolean;
  provider: EnsureEntityResult;
  citizen: EnsureEntityResult;
  scheme: EnsureEntityResult;
}

function normalizeLevel(level: string | null | undefined): string {
  if (!level) return 'LEVEL 4';
  const s = String(level).trim().toUpperCase().replace(/\s+/g, ' ');
  if (/^LEVEL\s*[2-6]$/.test(s)) return s.replace(/LEVEL\s*/, 'LEVEL ');
  const m = s.match(/([2-6])/);
  return m ? `LEVEL ${m[1]}` : 'LEVEL 4';
}

function orgHintsFromBundle(raw: unknown): { name?: string; level?: string } {
  if (!raw || typeof raw !== 'object') return {};
  const bundle = raw as { entry?: Array<{ resource?: Record<string, unknown> }> };
  const org = bundle.entry?.find(
    (e) => e.resource?.resourceType === 'Organization',
  )?.resource;
  if (!org) return {};
  const extensions = org.extension as
    | Array<{
        url?: string;
        valueCodeableConcept?: { coding?: Array<{ code?: string }> };
      }>
    | undefined;
  const ext = extensions?.find((e) => e.url?.includes('facility-level'));
  const level = ext?.valueCodeableConcept?.coding?.[0]?.code;
  return {
    name: typeof org.name === 'string' ? org.name : undefined,
    level,
  };
}

function isBundleBody(body: Record<string, unknown>): boolean {
  return body.resourceType === 'Bundle';
}

@Injectable()
export class RegistryEnsureService {
  constructor(
    private readonly claimDb: ClaimDbService,
    private readonly providers: ProviderRegistryService,
    private readonly registries: VerifiableRegistryService,
  ) {}

  /** Resolve validation time — mirrors submit registry checks. */
  resolveAtTime(parsed?: ParsedFhirBundle, override?: number): number {
    if (override != null && Number.isFinite(override)) {
      return Math.floor(override);
    }
    const now = Math.floor(Date.now() / 1000);
    if (process.env.REGISTRY_VALIDATE_AT_CLAIM_DATE === 'false') {
      return now;
    }
    if (parsed?.dateFrom) {
      return Number(parsed.dateFrom) || now;
    }
    return now;
  }

  /**
   * Ensure provider, citizen, and scheme registries exist on-chain.
   * Accepts a FHIR Bundle (root or `bundle` field) or explicit `{ fid, crId, schemeCode }`.
   */
  async ensure(body: Record<string, unknown>): Promise<EnsureRegistriesResult> {
    const { parsed, rawBundle, fid, crId, schemeCode, atTime } =
      this.resolveInput(body);

    if (!fid) {
      throw new BadRequestException(
        'fid is required (pass FHIR Bundle or { fid, crId, schemeCode })',
      );
    }
    if (!crId) {
      throw new BadRequestException(
        'crId is required (pass FHIR Bundle or { fid, crId, schemeCode })',
      );
    }

    const orgHints = rawBundle ? orgHintsFromBundle(rawBundle) : {};

    const provider = await this.ensureProvider(fid, atTime, orgHints);
    const citizen = await this.ensureVerifiable('citizen', crId, atTime);
    const scheme = schemeCode
      ? await this.ensureVerifiable('insurer', schemeCode, atTime)
      : {
          id: '',
          authorized: true,
          action: 'skipped' as EnsureAction,
          configured: this.registries.isConfigured('insurer'),
          source: 'request' as const,
        };

    const ok =
      provider.authorized &&
      (citizen.authorized || citizen.action === 'skipped') &&
      (scheme.authorized || scheme.action === 'skipped');

    return {
      ok,
      fid,
      crId,
      schemeCode: schemeCode || '',
      atTime,
      claimDbConfigured: this.claimDb.isConfigured(),
      provider,
      citizen,
      scheme,
    };
  }

  /** Called from submit path after FHIR parse — same logic as ensure API. */
  async ensureFromParsed(parsed: ParsedFhirBundle, rawBundle?: unknown) {
    return this.ensure({
      fid: parsed.fid,
      crId: parsed.crId,
      schemeCode: parsed.schemeCode,
      bundle: rawBundle,
      parsedAtTime: this.resolveAtTime(parsed),
    });
  }

  private resolveInput(body: Record<string, unknown>) {
    let parsed: ParsedFhirBundle | undefined;
    let rawBundle: unknown | undefined;

    if (body.bundle && typeof body.bundle === 'object') {
      rawBundle = body.bundle;
      parsed = parseFhirBundle(rawBundle);
    } else if (isBundleBody(body)) {
      rawBundle = body;
      parsed = parseFhirBundle(body);
    }

    const fid = String(parsed?.fid || body.fid || '').trim();
    const crId = String(parsed?.crId || body.crId || '').trim();
    const schemeCode = String(
      parsed?.schemeCode || body.schemeCode || '',
    ).trim();

    const atTime =
      body.parsedAtTime != null
        ? Number(body.parsedAtTime)
        : body.atTime != null
          ? Number(body.atTime)
          : this.resolveAtTime(parsed);

    return { parsed, rawBundle, fid, crId, schemeCode, atTime };
  }

  private async ensureProvider(
    fid: string,
    atTime: number,
    orgHints: { name?: string; level?: string },
  ): Promise<EnsureEntityResult> {
    try {
      const authorized = await this.providers.isProviderAuthorized(fid, atTime);
      if (authorized) {
        return {
          id: fid,
          authorized: true,
          action: 'none',
          source: 'on-chain',
        };
      }

      const dbRow = await this.claimDb.getProviderByFid(fid);
      const source: EnsureEntityResult['source'] = dbRow
        ? 'db'
        : orgHints.name || orgHints.level
          ? 'bundle'
          : 'minimal';

      const name =
        dbRow?.provider_name || orgHints.name || fid;
      const level = normalizeLevel(
        dbRow?.facility_level || dbRow?.provider_level || orgHints.level,
      );
      const county = dbRow?.county || 'UNKNOWN';

      const exists = await this.providers.providerExists(fid);
      if (exists) {
        const out = await this.providers.updateLicense(
          fid,
          LICENSE_FROM,
          LICENSE_TO,
        );
        const nowOk = await this.providers.isProviderAuthorized(fid, atTime);
        return {
          id: fid,
          authorized: nowOk,
          action: 'license_updated',
          txHash: out.txHash,
          source,
        };
      }

      const out = await this.providers.registerProvider({
        providerId: fid,
        name,
        level,
        county,
        facilityType: 'hospital',
        licenseValidFrom: LICENSE_FROM,
        licenseValidTo: LICENSE_TO,
      });

      const nowOk = await this.providers.isProviderAuthorized(fid, atTime);
      return {
        id: fid,
        authorized: nowOk,
        action: out.txHash ? 'registered' : 'none',
        txHash: out.txHash,
        alreadyRegistered: out.alreadyRegistered,
        source,
      };
    } catch (err: any) {
      return {
        id: fid,
        authorized: false,
        action: 'failed',
        error: err?.message || String(err),
      };
    }
  }

  private async ensureVerifiable(
    kind: 'citizen' | 'insurer',
    id: string,
    atTime: number,
  ): Promise<EnsureEntityResult> {
    if (!this.registries.isConfigured(kind)) {
      return {
        id,
        authorized: true,
        action: 'skipped',
        configured: false,
        source: 'request',
      };
    }

    try {
      const authorized = await this.registries.isAuthorized(kind, id, atTime);
      if (authorized) {
        return {
          id,
          authorized: true,
          action: 'none',
          configured: true,
          source: 'on-chain',
        };
      }

      const dbFound =
        kind === 'citizen'
          ? await this.claimDb.getCitizenByCrId(id)
          : await this.claimDb.getSchemeByCode(id);

      const source: EnsureEntityResult['source'] = dbFound
        ? 'db'
        : 'minimal';

      const body = {
        id,
        meta: '',
        validFrom: LICENSE_FROM,
        validTo: LICENSE_TO,
      };

      const exists = await this.registries.exists(kind, id);
      let out: { txHash?: string | null; alreadyRegistered?: boolean };
      let action: EnsureAction = 'registered';

      if (exists) {
        await this.registries.deregister(kind, id);
        out = await this.registries.register(kind, body);
        action = 'deregistered_and_registered';
      } else {
        out = await this.registries.register(kind, body);
        action = out.txHash ? 'registered' : 'none';
      }

      const nowOk = await this.registries.isAuthorized(kind, id, atTime);
      return {
        id,
        authorized: nowOk,
        action,
        txHash: out.txHash,
        alreadyRegistered: out.alreadyRegistered,
        configured: true,
        source,
      };
    } catch (err: any) {
      return {
        id,
        authorized: false,
        action: 'failed',
        configured: true,
        error: err?.message || String(err),
      };
    }
  }
}
