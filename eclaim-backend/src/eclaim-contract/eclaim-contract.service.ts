import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ethers } from 'ethers';
import * as ABI from './CLAIM_REGISTRY.json';
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

const META_FILE = path.join(process.cwd(), 'claim-meta.json');

const CONTRACT_ADDRESS =
  process.env.CLAIM_REGISTRY_ADDRESS ||
  '0xA8eFbf955496518D6e3Cb10ABC90627671534088';
const RPC_URL = process.env.SPEARHEAD_RPC_URL || 'https://rpc.spearhead.adifoundation.ai';

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

interface ClaimMeta {
  claimId: string;
  recordUse: RecordUse;
  claimType: string;
  fid: string;
  claimedTotal: string;
  creationDate: string;
  /** @deprecated legacy demo fields */
  patientName?: string;
  providerName?: string;
  shaCode?: string;
}

@Injectable()
export class EclaimContractService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private metaCache = new Map<number, ClaimMeta>();

  constructor(
    private readonly providerRegistry: ProviderRegistryService,
    private readonly verifiableRegistries: VerifiableRegistryService,
  ) {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, ABI.abi, this.provider);
    this.loadMetaFromDisk();
  }

  private loadMetaFromDisk() {
    try {
      if (fs.existsSync(META_FILE)) {
        const raw = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
        for (const [k, v] of Object.entries(raw)) {
          const m = v as Partial<ClaimMeta>;
          this.metaCache.set(Number(k), {
            claimId: m.claimId ?? '',
            recordUse: m.recordUse ?? 'claim',
            claimType: m.claimType ?? '',
            fid: m.fid ?? m.providerName ?? '',
            claimedTotal: m.claimedTotal ?? '0',
            creationDate: m.creationDate ?? '',
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
    this.metaCache.set(claimNumber, meta);
    this.saveMetaToDisk();
  }

  private ownerAddressCache: string | null = null;

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

  private async ownerStaticCall(fn: string, ...args: any[]) {
    const from = await this.ownerAddressForReads();
    return this.contract[fn].staticCall(...args, { from });
  }

  private mapClaimStruct(claim: any, meta?: ClaimMeta) {
    return {
      claimNumber: claim.claimNumber.toString(),
      claimId: meta?.claimId || '—',
      recordUse: meta?.recordUse || '—',
      claimType: meta?.claimType || '—',
      fid: meta?.fid || '—',
      claimedTotal: claim.claimedTotal.toString(),
      approvedTotal: '—',
      status: STATUS_MAP[Number(claim.status)] || 'unknown',
      dateFrom: claim.dateFrom.toString(),
      dateTo: claim.dateTo.toString(),
      creationDate: meta?.creationDate || '—',
      bundleHash: claim.bundleContentHash ?? claim.shaPackageCodeHash,
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
        `Insufficient ADI for gas on ${address}. Balance: ${ethers.formatEther(balance)} ADI, need ~${ethers.formatEther(required)} ADI. Top up the owner wallet on Spearhead.`,
      );
    }
  }

  getDeploymentInfo() {
    return this.ownerAddressForReads().then(async (ownerAddress) => {
      const network = await this.provider.getNetwork();
      return {
        network: 'Spearhead L3',
        chainId: Number(network.chainId),
        rpcUrl: RPC_URL,
        claimRegistryAddress: CONTRACT_ADDRESS,
        providerRegistryAddress:
          process.env.PROVIDER_REGISTRY_ADDRESS ||
          '0xeda747a951502878079a789DA5D3380dA6Ec2276',
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

  /** ClaimRegistry.upsertClaim requires msg.sender == owner(). */
  private async assertSignerIsOwner(signer: ethers.Wallet) {
    const onChainOwner: string = await this.contract.owner();
    const signerAddress = await signer.getAddress();
    if (onChainOwner.toLowerCase() !== signerAddress.toLowerCase()) {
      throw new BadRequestException(
        `OWNER_PRIVATE_KEY wallet (${signerAddress}) is not ClaimRegistry owner (${onChainOwner}). ` +
          `Set OWNER_PRIVATE_KEY to the owner account, or transfer ownership to ${signerAddress} ` +
          `(see deploy-contracts/scripts/transfer-claim-registry-ownership.js).`,
      );
    }
  }

  private async nextClaimNumber(): Promise<bigint> {
    const events = await this.queryClaimUpsertedEvents();
    let max = 0n;
    for (const e of events) {
      const n = BigInt(e.args.claimNumber);
      if (n > max) max = n;
    }
    const candidate = BigInt(Date.now());
    return candidate > max ? candidate : max + 1n;
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

  /** Parse FHIR Bundle, anchor on ClaimRegistry (hashes only — no PII on-chain). */
  async submitFhirBundle(raw: unknown) {
    const parsed = parseFhirBundle(raw);
    const isDuplicate = await this.checkDuplicate(parsed.claimId, parsed.recordUse);
    if (isDuplicate) {
      throw new BadRequestException(`Record already anchored for id "${parsed.claimId}"`);
    }

    await this.assertRegistriesAuthorize(parsed);

    const claimNumber = await this.nextClaimNumber();
    const claimStruct = buildClaimStruct(parsed, claimNumber);

    const signer = this.getSigner();
    await this.assertSignerIsOwner(signer);
    const contractWithSigner = this.contract.connect(signer) as ethers.Contract;
    await this.assertSufficientGas(signer, contractWithSigner, claimStruct);
    const tx = await contractWithSigner.upsertClaim(claimStruct);
    const receipt = await tx.wait();

    this.cacheClaimMeta(Number(claimNumber), {
      claimId: parsed.claimId,
      recordUse: parsed.recordUse,
      claimType: parsed.claimType,
      fid: parsed.fid,
      claimedTotal: parsed.claimedTotal.toString(),
      creationDate: new Date().toISOString(),
    });

    return {
      txHash: receipt.hash,
      claimNumber: claimNumber.toString(),
      claimId: parsed.claimId,
      recordUse: parsed.recordUse,
      fid: parsed.fid,
      bundleHash: parsed.bundleContentHash,
      claimedTotal: parsed.claimedTotal.toString(),
    };
  }

  async getClaim(claimNumber: number) {
    try {
      const claim = await this.ownerStaticCall('getClaim', claimNumber);
      const meta = this.metaCache.get(claimNumber);
      return this.mapClaimStruct(claim, meta);
    } catch (error: any) {
      if (error?.code === 'CALL_EXCEPTION') {
        throw new NotFoundException(`Claim ${claimNumber} not found`);
      }
      throw new InternalServerErrorException(error?.message || 'Failed to fetch claim');
    }
  }

  /** Find claimNumber by querying ClaimUpserted events filtered on claimIdHash (indexed) */
  private async findClaimNumberByIdHash(claimIdHash: string): Promise<number | null> {
    const CHUNK = 99_000;
    const latestBlock = await this.provider.getBlockNumber();
    const startBlock = Math.max(0, latestBlock - 500_000);

    const filter = this.contract.filters.ClaimUpserted(null, claimIdHash);

    for (let from = startBlock; from <= latestBlock; from += CHUNK) {
      const to = Math.min(from + CHUNK - 1, latestBlock);
      try {
        const chunk = await this.contract.queryFilter(filter, from, to);
        if (chunk.length > 0) {
          return Number((chunk[chunk.length - 1] as any).args.claimNumber);
        }
      } catch {
        // skip failed chunk
      }
    }
    return null;
  }

  async getClaimByClaimId(claimId: string) {
    const claimIdHash = h(claimId);
    let claimNumber = await this.findClaimNumberByIdHash(claimIdHash);

    // Fallback: treat input as an on-chain claimNumber if it looks numeric
    if (claimNumber === null && /^\d+$/.test(claimId)) {
      const n = Number(claimId);
      try {
        return await this.getClaim(n);
      } catch {
        // fall through to not-found
      }
    }

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

  private async queryClaimUpsertedEvents() {
    const CHUNK = 99_000;
    const latestBlock = await this.provider.getBlockNumber();
    const startBlock = Math.max(0, latestBlock - 500_000);
    const allEvents: any[] = [];

    const filter = this.contract.filters.ClaimUpserted();

    for (let from = startBlock; from <= latestBlock; from += CHUNK) {
      const to = Math.min(from + CHUNK - 1, latestBlock);
      try {
        const chunk = await this.contract.queryFilter(filter, from, to);
        allEvents.push(...chunk);
      } catch {
        // skip failed chunk
      }
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

      const total = ordered.length;
      const totalPages = Math.ceil(total / size) || 1;

      const filteredOrdered = recordUse
        ? ordered.filter((n) => this.metaCache.get(n)?.recordUse === recordUse)
        : ordered;
      const filteredTotal = filteredOrdered.length;
      const filteredPages = Math.ceil(filteredTotal / size) || 1;
      const sliceIds = filteredOrdered.slice(page * size, page * size + size);

      const claims = await Promise.all(
        sliceIds.map(async (claimNumber) => {
          const meta = this.metaCache.get(claimNumber);
          try {
            const claim = await this.ownerStaticCall('getClaim', claimNumber);
            return this.mapClaimStruct(claim, meta);
          } catch {
            return {
              claimNumber: claimNumber.toString(),
              claimId: meta?.claimId || '—',
              recordUse: meta?.recordUse || '—',
              claimType: meta?.claimType || '—',
              fid: meta?.fid || '—',
              claimedTotal: meta?.claimedTotal || '—',
              approvedTotal: '—',
              status: 'unknown',
              dateFrom: '—',
              dateTo: '—',
              creationDate: meta?.creationDate || '—',
              bundleHash: '—',
            };
          }
        }),
      );

      return {
        claims,
        page: {
          totalPages: recordUse ? filteredPages : totalPages,
          totalElements: recordUse ? filteredTotal : total,
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
    await this.assertSignerIsOwner(signer);
    const contractWithSigner = this.contract.connect(signer) as ethers.Contract;
    const tx = await contractWithSigner.setClaimStatus(claimNumber, status);
    const receipt = await tx.wait();
    return { txHash: txHashFromReceipt(receipt), claimNumber };
  }
}
