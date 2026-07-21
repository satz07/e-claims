import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ethers } from 'ethers';
import * as ABI from './CLAIM_REGISTRY.json';
import * as ABI_V1 from './CLAIM_REGISTRY_V1.json';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildClaimStruct,
  parseFhirBundle,
  RecordUse,
} from './fhir-bundle.parser';
import { txHashFromReceipt } from './tx-receipt.util';
import { ProviderRegistryService } from './provider-registry.service';
import { VerifiableRegistryService } from './verifiable-registry.service';
import { getActiveChain } from './chain-config';
import { logChainTransaction } from './tx-audit-log';

const META_FILE = path.join(process.cwd(), 'claim-meta.json');

const ACTIVE_CHAIN = getActiveChain();
const CONTRACT_ADDRESS =
  process.env.CLAIM_REGISTRY_ADDRESS ||
  '0x9a6b73f558Bad360a3251C220D383A0f641a58Bc';
const LEGACY_CONTRACT_ADDRESS = process.env.CLAIM_REGISTRY_V1_ADDRESS || '';
const RPC_URL = ACTIVE_CHAIN.rpcUrl;

const STATUS_MAP: Record<number, string> = {
  0: 'unknown',
  1: 'approved',
  2: 'rejected',
  3: 'declined',
  4: 'sent-back',
  5: 'sent-for-payment-processing',
  6: 'medical-review',
};

const ZERO_HASH = '0x' + '00'.repeat(32);

function h(s: string): string {
  if (!s) return ZERO_HASH;
  return ethers.keccak256(ethers.toUtf8Bytes(s));
}

/** Known plaintexts reversible from on-chain hashes (raw IDs are never stored on-chain). */
const KNOWN_LABELS: string[] = [
  'claim',
  'preauthorization',
  'institutional',
  'FID-35-108719-7',
  'CR3248022528592-4',
  'CAT-SHA-001',
  'CMP-DEMO-001',
  'PMF-12-001',
  'PMF-08-010',
  'PMF-15-002',
  'PMF-20-001',
  'PMF-11-003',
  'PMF-09-004',
  'PMF-14-007',
  'PMF-18-001',
  'PMF-07-002',
  'PMF-22-005',
  'LEVEL 2',
  'LEVEL 3',
  'LEVEL 4',
  'LEVEL 5',
  'LEVEL 6',
  ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25].flatMap(
    (i) => {
      const p = String(i).padStart(3, '0');
      return [`FID-SCALE-${p}`, `CR-SCALE-${p}`, `CAT-SCALE-${p}`, `CMP-SCALE-${p}`];
    },
  ),
];

const HASH_TO_LABEL = new Map<string, string>(
  KNOWN_LABELS.map((label) => [h(label).toLowerCase(), label]),
);

function shortHash(hash: string | undefined, head = 10, tail = 8): string {
  if (!hash || hash === ZERO_HASH) return '—';
  const s = String(hash);
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function labelFromHash(hash: string | undefined): string {
  if (!hash || hash === ZERO_HASH) return '—';
  return HASH_TO_LABEL.get(String(hash).toLowerCase()) || shortHash(String(hash));
}

function recordUseFromHash(hash: string | undefined): RecordUse | '—' {
  if (!hash || hash === ZERO_HASH) return '—';
  const label = HASH_TO_LABEL.get(String(hash).toLowerCase());
  if (label === 'claim' || label === 'preauthorization') return label;
  return '—';
}

export interface ClaimMeta {
  source?: 'fhir' | 'demo';
  claimId: string;
  recordUse: RecordUse;
  claimType: string;
  fid: string;
  claimedTotal: string;
  creationDate: string;
  crId?: string;
  schemeCode?: string;
  facilityLevel?: string;
  interventionCode?: string;
  bundleId?: string;
  ipsClaim?: boolean;
  /** @deprecated legacy demo fields */
  patientName?: string;
  providerName?: string;
  shaCode?: string;
}

@Injectable()
export class EclaimContractService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  /** Legacy (V1) contract — read-only for old data. Null when not configured. */
  private legacyContract: ethers.Contract | null;
  private metaCache = new Map<number, ClaimMeta>();
  /** Serializes on-chain submits so nonces and claimNumbers stay ordered under concurrency. */
  private submitChainLock: Promise<void> = Promise.resolve();
  /** Avoid re-scanning ClaimUpserted history on every submit; refreshed once then incremented. */
  private lastClaimNumberCache: bigint | null = null;

  constructor(
    private readonly providerRegistry: ProviderRegistryService,
    private readonly verifiableRegistries: VerifiableRegistryService,
  ) {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, ABI.abi, this.provider);
    this.legacyContract = LEGACY_CONTRACT_ADDRESS
      ? new ethers.Contract(LEGACY_CONTRACT_ADDRESS, ABI_V1.abi, this.provider)
      : null;
    this.loadMetaFromDisk();
  }

  private loadMetaFromDisk() {
    try {
      if (fs.existsSync(META_FILE)) {
        const raw = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
        for (const [k, v] of Object.entries(raw)) {
          const m = v as Partial<ClaimMeta>;
          this.metaCache.set(Number(k), {
            source: m.source ?? (m.patientName || m.shaCode ? 'demo' : 'fhir'),
            claimId: m.claimId ?? '',
            recordUse: m.recordUse ?? 'claim',
            claimType: m.claimType ?? '',
            fid: m.fid ?? m.providerName ?? '',
            claimedTotal: m.claimedTotal ?? '0',
            creationDate: m.creationDate ?? '',
            crId: m.crId,
            schemeCode: m.schemeCode,
            facilityLevel: m.facilityLevel,
            interventionCode: m.interventionCode,
            bundleId: m.bundleId,
            ipsClaim: m.ipsClaim,
            patientName: m.patientName,
            providerName: m.providerName,
            shaCode: m.shaCode,
          });
        }
      }
    } catch { /* ignore corrupt file */ }
  }

  private saveMetaToDisk() {
    try {
      const obj: Record<string, ClaimMeta> = {};
      for (const [k, v] of this.metaCache) obj[String(k)] = v;
      fs.writeFileSync(META_FILE, JSON.stringify(obj, null, 2));
    } catch { /* ignore write errors */ }
  }

  cacheClaimMeta(claimNumber: number, meta: ClaimMeta) {
    this.metaCache.set(claimNumber, { ...meta, source: meta.source ?? 'fhir' });
    this.saveMetaToDisk();
  }

  private formatUnix(ts: bigint | number | string | undefined): string {
    const n = Number(ts ?? 0);
    if (!n) return '—';
    return new Date(n * 1000).toISOString().slice(0, 10);
  }

  private isDemoMeta(meta?: ClaimMeta): boolean {
    if (!meta) return false;
    if (meta.source === 'demo') return true;
    return !!(meta.patientName || meta.shaCode);
  }

  private isFhirOnChain(claim: any): boolean {
    const flh = claim?.providerLevelHash;
    return !!flh && flh !== ZERO_HASH;
  }

  private isFhirClaim(claimNumber: number, meta?: ClaimMeta, claim?: any): boolean {
    if (this.isDemoMeta(meta)) return false;
    if (meta?.source === 'fhir') return true;
    if (claim && this.isFhirOnChain(claim)) return true;
    if (meta && meta.claimType === 'institutional' && !meta.patientName && !meta.shaCode) {
      return true;
    }
    return false;
  }

  private fhirMetaFromParsed(parsed: ReturnType<typeof parseFhirBundle>): ClaimMeta {
    return {
      source: 'fhir',
      claimId: parsed.claimId,
      recordUse: parsed.recordUse,
      claimType: parsed.claimType,
      fid: parsed.fid,
      claimedTotal: parsed.claimedTotal.toString(),
      creationDate: this.formatUnix(parsed.creationDate),
      crId: parsed.crId,
      schemeCode: parsed.schemeCode,
      facilityLevel: parsed.facilityLevel,
      interventionCode: parsed.interventionCode,
      bundleId: parsed.bundleId,
      ipsClaim: parsed.ipsClaim,
    };
  }

  private ownerAddressCache: string | null = null;
  private legacyOwnerAddressCache: string | null = null;

  private async ownerAddressForReads(): Promise<string> {
    if (this.ownerAddressCache) return this.ownerAddressCache;
    try {
      const key = process.env.OWNER_PRIVATE_KEY;
      if (key) {
        const w = new ethers.Wallet(key.startsWith('0x') ? key : `0x${key}`);
        this.ownerAddressCache = w.address;
        return this.ownerAddressCache;
      }
    } catch { /* fall through */ }
    this.ownerAddressCache = await this.contract.owner();
    return this.ownerAddressCache;
  }

  /** V1 getClaim is onlyOwner — must simulate as on-chain owner, not an authorized submitter. */
  private async legacyOwnerAddressForReads(): Promise<string> {
    if (this.legacyOwnerAddressCache) return this.legacyOwnerAddressCache;
    if (!this.legacyContract) {
      return this.ownerAddressForReads();
    }
    this.legacyOwnerAddressCache = await this.legacyContract.owner();
    return this.legacyOwnerAddressCache;
  }

  private async ownerStaticCall(fn: string, ...args: any[]) {
    const from = await this.ownerAddressForReads();
    return this.contract[fn].staticCall(...args, { from });
  }

  /** Normalize V1 struct field names to match the V3 names used by mapClaimStruct. */
  private normalizeV1Claim(claim: any): any {
    if (claim.providerNameHash !== undefined) return claim; // already V3
    return {
      ...claim,
      claimNumber: claim.claimNumber,
      claimIdHash: claim.claimIdHash,
      claimTypeHash: claim.claimTypeHash,
      providerNameHash: claim.fidHash,
      providerLevelHash: claim.facilityLevelHash,
      bundleIdHash: claim.bundleIdHash,
      shaCodeHash: claim.schemeCodeHash,
      shaPackageCodeHash: claim.bundleContentHash,
      crIdHash: claim.crIdHash,
      claimCodeHash: claim.interventionCodeHash,
      nationalIdHash: claim.nationalIdHash,
      creationDate: claim.creationDate,
      dateFrom: claim.dateFrom,
      dateTo: claim.dateTo,
      claimedTotal: claim.claimedTotal,
      ipsClaim: claim.ipsClaim,
      status: claim.status,
    };
  }

  private mapClaimStruct(claim: any, meta?: ClaimMeta) {
    const claimType =
      meta?.claimType ||
      labelFromHash(claim?.claimTypeHash);
    const recordUse =
      meta?.recordUse || '—';
    return {
      claimNumber: claim.claimNumber.toString(),
      claimId: meta?.claimId?.trim() || shortHash(claim?.claimIdHash),
      claimIdHash: claim?.claimIdHash ? String(claim.claimIdHash) : undefined,
      recordUse,
      claimType: claimType === '—' ? '—' : claimType,
      fid: meta?.fid?.trim() || labelFromHash(claim?.providerNameHash),
      crId: meta?.crId?.trim() || labelFromHash(claim?.crIdHash),
      schemeCode: meta?.schemeCode?.trim() || labelFromHash(claim?.shaCodeHash),
      facilityLevel:
        meta?.facilityLevel?.trim() || labelFromHash(claim?.providerLevelHash),
      interventionCode:
        meta?.interventionCode?.trim() ||
        labelFromHash(claim?.claimCodeHash),
      bundleId: meta?.bundleId?.trim() || shortHash(claim?.bundleIdHash),
      ipsClaim: meta?.ipsClaim ?? claim.ipsClaim ?? false,
      claimedTotal: claim.claimedTotal.toString(),
      dateFrom: this.formatUnix(claim.dateFrom),
      dateTo: this.formatUnix(claim.dateTo),
      creationDate: meta?.creationDate || this.formatUnix(claim.creationDate),
      bundleHash: claim.shaPackageCodeHash,
      status: STATUS_MAP[Number(claim.status)] || 'unknown',
    };
  }

  private getSigner() {
    const key = process.env.OWNER_PRIVATE_KEY;
    if (!key) {
      throw new BadRequestException('OWNER_PRIVATE_KEY is not configured on the server');
    }
    return new ethers.Wallet(key, this.provider);
  }

  private async assertSufficientGas(
    signer: ethers.Wallet,
    contractWithSigner: ethers.Contract,
    claimStruct: ReturnType<typeof buildClaimStruct>,
  ) {
    const address = await signer.getAddress();
    const balance = await this.provider.getBalance(address);
    let gasLimit: bigint;
    try {
      gasLimit = await contractWithSigner.upsertClaim.estimateGas(claimStruct);
      gasLimit = (gasLimit * 120n) / 100n;
    } catch {
      gasLimit = 500_000n;
    }
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? 552_000_000_000n;
    const required = gasPrice * gasLimit;
    if (balance < required) {
      throw new BadRequestException(
        `Insufficient ADI for gas on ${address}. Balance: ${ethers.formatEther(balance)} ADI, need ~${ethers.formatEther(required)} ADI. Top up the owner wallet on ${ACTIVE_CHAIN.shortName}.`,
      );
    }
  }

  getDeploymentInfo() {
    return this.ownerAddressForReads().then(async (ownerAddress) => {
      const network = await this.provider.getNetwork();
      return {
        network: ACTIVE_CHAIN.name,
        networkKey: ACTIVE_CHAIN.key,
        chainId: Number(network.chainId),
        rpcUrl: RPC_URL,
        explorerUrl: ACTIVE_CHAIN.explorerUrl,
        protocolVersion: ACTIVE_CHAIN.protocolVersion ?? null,
        claimRegistryAddress: CONTRACT_ADDRESS,
        legacyClaimRegistryAddress: LEGACY_CONTRACT_ADDRESS || null,
        providerRegistryAddress:
          process.env.PROVIDER_REGISTRY_ADDRESS ||
          '0x03f6849d7c37aF5E8535FFE6E10d4B6e3F44e8E8',
        citizenRegistryAddress: this.verifiableRegistries.addressFor('citizen'),
        clinicianRegistryAddress: this.verifiableRegistries.addressFor('clinician'),
        insurerRegistryAddress: this.verifiableRegistries.addressFor('insurer'),
        ownerAddress,
        onChainFields: [
          'claimIdHash (keccak256 of Claim.identifier)',
          'bundleIdHash + bundleContentHash (full bundle integrity)',
          'recordUseHash (claim | preauthorization)',
          'fidHash, facilityLevelHash, schemeCodeHash',
          'crIdHash, nationalIdHash (hashed identifiers only)',
          'claimTypeHash, interventionCodeHash',
          'dateFrom, dateTo, claimedTotal, ipsClaim flag',
          'status (uint8 lifecycle code)',
        ],
        offChainFields: [
          'Full FHIR Bundle JSON',
          'Patient name, phone, DOB, demographics',
          'Diagnosis, clinical notes, attachments, invoices',
          'Organization display name and free-text fields',
        ],
      };
    });
  }

  /** ClaimRegistry V3: owner OR authorizedSubmitters. V1 fallback: owner only. */
  private async assertSignerIsAuthorized(signer: ethers.Wallet) {
    const signerAddress = await signer.getAddress();
    const onChainOwner: string = await this.contract.owner();
    if (onChainOwner.toLowerCase() === signerAddress.toLowerCase()) return;

    // V3 contract has authorizedSubmitters mapping
    try {
      const isSubmitter = await this.contract.authorizedSubmitters(signerAddress);
      if (isSubmitter) return;
    } catch {
      // V1 contract doesn't have authorizedSubmitters — fall through
    }

    throw new BadRequestException(
      `Wallet (${signerAddress}) is not ClaimRegistry owner (${onChainOwner}) and not an authorized submitter. ` +
        `Set OWNER_PRIVATE_KEY to the owner/submitter account, or call addSubmitter(${signerAddress}) on the contract.`,
    );
  }

  private async nextClaimNumber(): Promise<bigint> {
    let max = this.lastClaimNumberCache ?? 0n;
    if (this.lastClaimNumberCache == null) {
      const events = await this.queryClaimUpsertedEvents();
      for (const e of events) {
        const n = BigInt(e.args.claimNumber);
        if (n > max) max = n;
      }
    }
    const candidate = BigInt(Date.now());
    const next = candidate > max ? candidate : max + 1n;
    this.lastClaimNumberCache = next;
    return next;
  }

  /** Validate facility + citizen + scheme against hash registries before gas spend. */
  private async assertRegistriesAuthorize(parsed: ReturnType<typeof parseFhirBundle>) {
    const atTime = Number(parsed.dateFrom) || Math.floor(Date.now() / 1000);
    const strict = process.env.REGISTRY_VALIDATION_ENABLED !== 'false';

    if (strict) {
      const providerOk = await this.providerRegistry.isProviderAuthorized(
        parsed.fid,
        atTime,
      );
      if (!providerOk) {
        throw new BadRequestException(
          `Facility "${parsed.fid}" is not registered or not authorized in ProviderRegistry. ` +
            `Register at /provider-registry or POST /api/public/integration/seed-demo-registries.`,
        );
      }
    }

    if (this.verifiableRegistries.isConfigured('citizen')) {
      const ok = await this.verifiableRegistries.isAuthorized(
        'citizen',
        parsed.crId,
        atTime,
      );
      if (!ok) {
        throw new BadRequestException(
          `Citizen CR "${parsed.crId}" is not registered or not authorized. ` +
            `Register at /citizen-registry or seed demo registries.`,
        );
      }
    }

    if (this.verifiableRegistries.isConfigured('insurer') && parsed.schemeCode) {
      const ok = await this.verifiableRegistries.isAuthorized(
        'insurer',
        parsed.schemeCode,
        atTime,
      );
      if (!ok) {
        throw new BadRequestException(
          `Scheme "${parsed.schemeCode}" is not registered or not authorized. ` +
            `Register at /insurer-registry or seed demo registries.`,
        );
      }
    }
  }

  /** Parse + validate FHIR; return claim struct for client-side MetaMask signing (no server tx). */
  async prepareFhirSubmit(raw: unknown) {
    const parsed = parseFhirBundle(raw);
    const isDuplicate = await this.checkDuplicate(parsed.claimId, parsed.recordUse);
    if (isDuplicate) {
      throw new BadRequestException(`Record already anchored for id "${parsed.claimId}"`);
    }
    await this.assertRegistriesAuthorize(parsed);
    const claimNumber = await this.nextClaimNumber();
    const claimStruct = buildClaimStruct(parsed, claimNumber);
    return {
      claimStruct: {
        claimIdHash: claimStruct.claimIdHash,
        claimNumber: claimStruct.claimNumber.toString(),
        claimTypeHash: claimStruct.claimTypeHash,
        providerNameHash: claimStruct.providerNameHash,
        providerLevelHash: claimStruct.providerLevelHash,
        bundleIdHash: claimStruct.bundleIdHash,
        shaCodeHash: claimStruct.shaCodeHash,
        crIdHash: claimStruct.crIdHash,
        nationalIdHash: claimStruct.nationalIdHash,
        claimCodeHash: claimStruct.claimCodeHash,
        creationDate: claimStruct.creationDate.toString(),
        dateFrom: claimStruct.dateFrom.toString(),
        dateTo: claimStruct.dateTo.toString(),
        claimedTotal: claimStruct.claimedTotal.toString(),
        ipsClaim: claimStruct.ipsClaim,
        status: claimStruct.status,
      },
      claimId: parsed.claimId,
      recordUse: parsed.recordUse,
      fid: parsed.fid,
      bundleHash: parsed.bundleContentHash,
      claimedTotal: parsed.claimedTotal.toString(),
      meta: this.fhirMetaFromParsed(parsed),
    };
  }

  private async withSubmitLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.submitChainLock.then(() => fn());
    this.submitChainLock = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** Parse FHIR Bundle, anchor on ClaimRegistry (hashes only — no PII on-chain). */
  async submitFhirBundle(raw: unknown, opts?: { wait?: boolean }) {
    const wait = opts?.wait !== false;
    const parsed = parseFhirBundle(raw);
    const isDuplicate = await this.checkDuplicate(parsed.claimId, parsed.recordUse);
    if (isDuplicate) {
      throw new BadRequestException(`Record already anchored for id "${parsed.claimId}"`);
    }

    await this.assertRegistriesAuthorize(parsed);

    return this.withSubmitLock(async () => {
      const claimNumber = await this.nextClaimNumber();
      const claimStruct = buildClaimStruct(parsed, claimNumber);

      const signer = this.getSigner();
      await this.assertSignerIsAuthorized(signer);
      const contractWithSigner = this.contract.connect(signer) as ethers.Contract;
      await this.assertSufficientGas(signer, contractWithSigner, claimStruct);
      const tx = await contractWithSigner.upsertClaim(claimStruct);

      const meta = this.fhirMetaFromParsed(parsed);
      this.cacheClaimMeta(Number(claimNumber), meta);

      const base = {
        txHash: tx.hash,
        claimNumber: claimNumber.toString(),
        claimId: parsed.claimId,
        recordUse: parsed.recordUse,
        fid: parsed.fid,
        bundleHash: parsed.bundleContentHash,
        claimedTotal: parsed.claimedTotal.toString(),
        pending: !wait,
      };

      if (!wait) {
        void tx
          .wait()
          .then(async (receipt) => {
            if (!receipt) return;
            await logChainTransaction({
              label: 'submitFhirBundle / upsertClaim',
              contractName: 'ClaimRegistry',
              contractAddress: CONTRACT_ADDRESS,
              tx,
              receipt,
              provider: this.provider,
              extra: {
                claimNumber: claimNumber.toString(),
                claimId: parsed.claimId,
                recordUse: parsed.recordUse,
                fid: parsed.fid,
                claimedTotal: parsed.claimedTotal.toString(),
              },
            });
          })
          .catch((err) => {
            console.error('[submitFhirBundle] async receipt failed', err?.message || err);
          });
        return base;
      }

      const receipt = await tx.wait();
      await logChainTransaction({
        label: 'submitFhirBundle / upsertClaim',
        contractName: 'ClaimRegistry',
        contractAddress: CONTRACT_ADDRESS,
        tx,
        receipt,
        provider: this.provider,
        extra: {
          claimNumber: claimNumber.toString(),
          claimId: parsed.claimId,
          recordUse: parsed.recordUse,
          fid: parsed.fid,
          claimedTotal: parsed.claimedTotal.toString(),
        },
      });

      return { ...base, txHash: receipt.hash, pending: false };
    });
  }

  async getClaim(claimNumber: number) {
    const meta = this.metaCache.get(claimNumber);

    // Try primary (new) contract first
    try {
      const claim = await this.ownerStaticCall('getClaim', claimNumber);
      if (this.isFhirClaim(claimNumber, meta, claim)) {
        return this.mapClaimStruct(claim, meta);
      }
    } catch { /* not found in primary — try legacy */ }

    // Try legacy contract
    if (this.legacyContract) {
      try {
        const from = await this.legacyOwnerAddressForReads();
        const raw = await this.legacyContract['getClaim'].staticCall(claimNumber, { from });
        const claim = this.normalizeV1Claim(raw);
        if (this.isFhirClaim(claimNumber, meta, claim)) {
          return this.mapClaimStruct(claim, meta);
        }
      } catch { /* not found in legacy either */ }
    }

    throw new NotFoundException(`Claim ${claimNumber} not found`);
  }

  private async findIdHashInContract(contract: ethers.Contract, claimIdHash: string): Promise<number | null> {
    const CHUNK = 99_000;
    const latestBlock = await this.provider.getBlockNumber();
    const startBlock = Math.max(0, latestBlock - 500_000);
    const filter = contract.filters.ClaimUpserted(null, claimIdHash);
    for (let from = startBlock; from <= latestBlock; from += CHUNK) {
      const to = Math.min(from + CHUNK - 1, latestBlock);
      try {
        const chunk = await contract.queryFilter(filter, from, to);
        if (chunk.length > 0) {
          return Number((chunk[chunk.length - 1] as any).args.claimNumber);
        }
      } catch {
        // skip failed chunk
      }
    }
    return null;
  }

  /** Find claimNumber by querying ClaimUpserted events filtered on claimIdHash (both contracts) */
  private async findClaimNumberByIdHash(claimIdHash: string): Promise<number | null> {
    const result = await this.findIdHashInContract(this.contract, claimIdHash);
    if (result !== null) return result;
    if (this.legacyContract) {
      return this.findIdHashInContract(this.legacyContract, claimIdHash);
    }
    return null;
  }

  async getClaimByClaimId(claimId: string) {
    if (!claimId?.trim()) {
      throw new BadRequestException('claimId is required');
    }
    const claimIdHash = h(claimId);
    const claimNumber = await this.findClaimNumberByIdHash(claimIdHash);

    if (claimNumber === null) {
      throw new NotFoundException(`No claim found for claimId "${claimId}"`);
    }
    return this.getClaim(claimNumber);
  }

  async checkDuplicate(claimId: string, _fileType: string) {
    if (!claimId) return false;
    const claimIdHash = h(claimId);
    const claimNumber = await this.findClaimNumberByIdHash(claimIdHash);
    return claimNumber !== null;
  }

  private async queryEventsFrom(contract: ethers.Contract) {
    const CHUNK = 99_000;
    const latestBlock = await this.provider.getBlockNumber();
    const startBlock = Math.max(0, latestBlock - 500_000);
    const events: any[] = [];
    const filter = contract.filters.ClaimUpserted();
    for (let from = startBlock; from <= latestBlock; from += CHUNK) {
      const to = Math.min(from + CHUNK - 1, latestBlock);
      try {
        const chunk = await contract.queryFilter(filter, from, to);
        events.push(...chunk);
      } catch {
        // skip failed chunk
      }
    }
    return events;
  }

  /** Query ClaimUpserted events from both the current and legacy contract. */
  private async queryClaimUpsertedEvents() {
    const allEvents = await this.queryEventsFrom(this.contract);
    if (this.legacyContract) {
      const legacyEvents = await this.queryEventsFrom(this.legacyContract);
      allEvents.push(...legacyEvents);
    }
    return allEvents;
  }

  async getAllClaims(page = 0, size = 20, recordUse?: RecordUse) {
    try {
      const events = await this.queryClaimUpsertedEvents();

      const seenNumbers = new Set<number>();
      const ordered: number[] = [];
      for (const e of events) {
        const n = Number(e.args.claimNumber);
        if (!seenNumbers.has(n)) {
          seenNumbers.add(n);
          ordered.push(n);
        }
      }

      // Newest first
      ordered.reverse();

      // On-chain first — does not require local claim-meta.json
      const from = await this.ownerAddressForReads();
      const tryGetClaim = async (n: number) => {
        try {
          return await this.contract['getClaim'].staticCall(n, { from });
        } catch {
          if (this.legacyContract) {
            try {
              const legacyFrom = await this.legacyOwnerAddressForReads();
              const raw = await this.legacyContract['getClaim'].staticCall(n, { from: legacyFrom });
              return this.normalizeV1Claim(raw);
            } catch { /* not found */ }
          }
          return null;
        }
      };

      const loaded = await Promise.all(
        ordered.map(async (n) => {
          const meta = this.metaCache.get(n);
          if (this.isDemoMeta(meta)) return null;
          try {
            const claim = await tryGetClaim(n);
            if (!claim) return null;
            if (!this.isFhirClaim(n, meta, claim)) return null;
            const use = meta?.recordUse || '—';
            if (recordUse && use !== recordUse) return null;
            return { n, claim, meta };
          } catch {
            return null;
          }
        }),
      );

      const fhirRows = loaded.filter(Boolean) as {
        n: number;
        claim: any;
        meta?: ClaimMeta;
      }[];

      const filteredTotal = fhirRows.length;
      const filteredPages = Math.ceil(filteredTotal / size) || 1;
      const slice = fhirRows.slice(page * size, page * size + size);

      const claims = slice.map(({ claim, meta }) =>
        this.mapClaimStruct(claim, meta),
      );

      return {
        claims,
        page: {
          totalPages: filteredPages,
          totalElements: filteredTotal,
          size,
          number: page,
        },
      };
    } catch (error: any) {
      throw new InternalServerErrorException(error?.message || 'Failed to fetch claims');
    }
  }

  async setClaimStatus(claimNumber: number, status: number) {
    const signer = this.getSigner();
    await this.assertSignerIsAuthorized(signer);
    const contractWithSigner = this.contract.connect(signer) as ethers.Contract;
    const tx = await contractWithSigner.setClaimStatus(claimNumber, status);
    const receipt = await tx.wait();
    await logChainTransaction({
      label: 'setClaimStatus',
      contractName: 'ClaimRegistry',
      contractAddress: CONTRACT_ADDRESS,
      tx,
      receipt,
      provider: this.provider,
      extra: { claimNumber, status },
    });
    return { txHash: txHashFromReceipt(receipt), claimNumber };
  }
}
