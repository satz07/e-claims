import { BadRequestException } from '@nestjs/common';
import { ethers } from 'ethers';

export type RecordUse = 'claim' | 'preauthorization';

/** Fields extracted from QA MIS institutional bundle profile only. */
export interface ParsedFhirBundle {
  bundleId: string;
  claimId: string;
  recordUse: RecordUse;
  claimType: string;
  subType: string;
  fid: string;
  facilityLevel: string;
  crId: string;
  nationalId: string;
  claimedTotal: bigint;
  dateFrom: bigint;
  dateTo: bigint;
  creationDate: bigint;
  interventionCode: string;
  schemeCode: string;
  ipsClaim: boolean;
  bundleContentHash: string;
}

const ZERO_HASH = '0x' + '00'.repeat(32);

export function hashUtf8(s: string): string {
  if (!s) return ZERO_HASH;
  return ethers.keccak256(ethers.toUtf8Bytes(s));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(value as object).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

function parseUnix(iso: string | undefined): bigint {
  if (!iso) return 0n;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 0n;
  return BigInt(Math.floor(ms / 1000));
}

function refId(ref: string | undefined): string {
  if (!ref) return '';
  const parts = ref.split('/');
  return parts[parts.length - 1] || '';
}

function findResource<T extends { resourceType: string }>(
  bundle: { entry?: Array<{ resource?: T }> },
  type: string,
): T | undefined {
  return bundle.entry?.find((e) => e.resource?.resourceType === type)?.resource;
}

function claimIdentifier(claim: any): string {
  const ids = claim?.identifier;
  if (!Array.isArray(ids)) return '';
  const official =
    ids.find((i: any) => i.system?.includes('/claim') || i.use === 'official') ?? ids[0];
  return official?.value ?? '';
}

function extractSchemeCode(bundle: any): string {
  const coverage = findResource(bundle, 'Coverage') as any;
  const ext = coverage?.extension?.find((e: any) =>
    e.url?.includes('schemeCategoryCode'),
  );
  return ext?.valueString ?? '';
}

function extractFacilityLevel(org: any): string {
  const ext = org?.extension?.find((e: any) => e.url?.includes('facility-level'));
  return ext?.valueCodeableConcept?.coding?.[0]?.code ?? '';
}

function extractInterventionCode(claim: any): string {
  return claim?.item?.[0]?.productOrService?.coding?.[0]?.code ?? '';
}

function normalizeRecordUse(use: string | undefined): RecordUse {
  const u = (use ?? '').toLowerCase();
  if (u === 'claim') return 'claim';
  if (u === 'preauthorization' || u === 'preauth') return 'preauthorization';
  throw new BadRequestException(
    `Claim.use must be "claim" or "preauthorization", got "${use ?? ''}"`,
  );
}

export function parseFhirBundle(raw: unknown): ParsedFhirBundle {
  if (!raw || typeof raw !== 'object') {
    throw new BadRequestException('Body must be a FHIR Bundle JSON object');
  }

  const bundle = raw as any;
  if (bundle.resourceType !== 'Bundle') {
    throw new BadRequestException('resourceType must be Bundle');
  }
  if (!bundle.id) {
    throw new BadRequestException('Bundle.id is required');
  }

  const claimRes = findResource(bundle, 'Claim');
  if (!claimRes) {
    throw new BadRequestException('Bundle must contain a Claim resource');
  }
  const claim = claimRes as any;

  const org = findResource(bundle, 'Organization') as any;
  const patient = findResource(bundle, 'Patient') as any;

  if (!findResource(bundle, 'Coverage')) {
    throw new BadRequestException('Bundle must contain a Coverage resource');
  }

  const claimId = claimIdentifier(claim);
  if (!claimId) {
    throw new BadRequestException('Claim.identifier value is required');
  }

  const recordUse = normalizeRecordUse(claim.use);
  const fid = org?.id ?? refId(claim.provider?.reference);
  if (!fid) {
    throw new BadRequestException('Organization.id (FID) is required');
  }

  const total = claim.total?.value;
  if (total === undefined || total === null || Number(total) <= 0) {
    throw new BadRequestException('Claim.total.value must be greater than zero');
  }

  const dateFrom = parseUnix(claim.billablePeriod?.start);
  const dateTo = parseUnix(claim.billablePeriod?.end);
  if (dateFrom === 0n || dateTo === 0n) {
    throw new BadRequestException('Claim.billablePeriod start and end are required');
  }

  const crId = patient?.id ?? refId(claim.patient?.reference);
  if (!crId) {
    throw new BadRequestException('Patient.id (CR) is required');
  }

  const nationalId =
    patient?.identifier?.find((i: any) => i.system?.includes('nationalid'))?.value ?? '';

  const subType = claim.subType?.coding?.[0]?.code ?? '';
  const claimType = claim.type?.coding?.[0]?.code ?? '';
  if (!claimType) {
    throw new BadRequestException('Claim.type is required');
  }

  const interventionCode = extractInterventionCode(claim);
  if (!interventionCode) {
    throw new BadRequestException('Claim.item[0].productOrService code is required');
  }

  const schemeCode = extractSchemeCode(bundle);
  if (!schemeCode) {
    throw new BadRequestException('Coverage schemeCategoryCode is required');
  }

  return {
    bundleId: bundle.id,
    claimId,
    recordUse,
    claimType,
    subType,
    fid,
    facilityLevel: extractFacilityLevel(org),
    crId,
    nationalId,
    claimedTotal: BigInt(Math.floor(Number(total))),
    dateFrom,
    dateTo,
    creationDate: parseUnix(claim.created) || BigInt(Math.floor(Date.now() / 1000)),
    interventionCode,
    schemeCode,
    ipsClaim: subType.toLowerCase() === 'ip',
    bundleContentHash: hashUtf8(stableStringify(bundle)),
  };
}

export function buildClaimStruct(parsed: ParsedFhirBundle, claimNumber: bigint) {
  return {
    claimIdHash: hashUtf8(parsed.claimId),
    claimNumber,
    bundleIdHash: hashUtf8(parsed.bundleId),
    bundleContentHash: parsed.bundleContentHash,
    recordUseHash: hashUtf8(parsed.recordUse),
    fidHash: hashUtf8(parsed.fid),
    facilityLevelHash: hashUtf8(parsed.facilityLevel),
    schemeCodeHash: hashUtf8(parsed.schemeCode),
    crIdHash: hashUtf8(parsed.crId),
    nationalIdHash: hashUtf8(parsed.nationalId),
    claimTypeHash: hashUtf8(parsed.claimType),
    interventionCodeHash: hashUtf8(parsed.interventionCode),
    creationDate: parsed.creationDate,
    dateFrom: parsed.dateFrom,
    dateTo: parsed.dateTo,
    claimedTotal: parsed.claimedTotal,
    ipsClaim: parsed.ipsClaim,
    status: 0,
  };
}
