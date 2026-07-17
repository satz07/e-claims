import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ethers } from 'ethers';
import * as ABI from './PROVIDER_REGISTRY.json';
import { txHashFromReceipt } from './tx-receipt.util';
import { getActiveChain } from './chain-config';
import { waitAndAudit } from './tx-audit-log';

const PROVIDER_REGISTRY_ADDRESS =
  process.env.PROVIDER_REGISTRY_ADDRESS ||
  '0xeda747a951502878079a789DA5D3380dA6Ec2276';
const RPC_URL = getActiveChain().rpcUrl;

const STATUS_MAP: Record<number, string> = {
  0: 'registered',
  1: 'deregistered',
  2: 'suspended',
  3: 'expired',
};

const KNOWN_TIERS = ['Tier-1', 'Tier-2', 'Tier-3'];
const KNOWN_FACILITY_TYPES = ['hospital', 'clinic', 'pharmacy', 'laboratory'];

const ZERO_HASH = '0x' + '00'.repeat(32);

function h(s: string): string {
  if (!s) return ZERO_HASH;
  return ethers.keccak256(ethers.toUtf8Bytes(s));
}

@Injectable()
export class ProviderRegistryService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.contract = new ethers.Contract(
      PROVIDER_REGISTRY_ADDRESS,
      ABI.abi,
      this.provider,
    );
  }

  private getSigner() {
    const key = process.env.OWNER_PRIVATE_KEY || '';
    if (!key) {
      throw new InternalServerErrorException('OWNER_PRIVATE_KEY not configured');
    }
    return new ethers.Wallet(key, this.provider);
  }

  private connectedContract() {
    return this.contract.connect(this.getSigner()) as ethers.Contract;
  }

  private formatDate(unix: bigint | number): string {
    const n = Number(unix);
    if (!n) return '—';
    return new Date(n * 1000).toISOString().slice(0, 10);
  }

  private shortHash(hash: string): string {
    if (!hash || hash.length < 12) return hash || '—';
    return `${hash.slice(0, 10)}…`;
  }

  private resolveHashedLabel(hash: string, candidates: string[]): string {
    const normalized = String(hash).toLowerCase();
    for (const label of candidates) {
      if (h(label).toLowerCase() === normalized) return label;
    }
    return this.shortHash(hash);
  }

  private mapProviderStruct(
    provider: any,
    authorized?: boolean,
    providerIdLabel?: string,
  ) {
    const statusNum = Number(provider.status);
    const levelHash = String(provider.levelHash);
    const facilityHash = String(provider.facilityTypeHash);
    const idHash = String(provider.providerIdHash);

    return {
      providerId: providerIdLabel || this.shortHash(idHash),
      providerIdHash: idHash,
      nameHash: String(provider.nameHash),
      level: this.resolveHashedLabel(levelHash, KNOWN_TIERS),
      levelHash,
      countyHash: String(provider.countyHash),
      facilityType: this.resolveHashedLabel(facilityHash, KNOWN_FACILITY_TYPES),
      facilityTypeHash: facilityHash,
      status: STATUS_MAP[statusNum] || 'unknown',
      licenseValidFrom: this.formatDate(provider.licenseValidFrom),
      licenseValidTo: this.formatDate(provider.licenseValidTo),
      registeredAt: this.formatDate(provider.registeredAt),
      updatedAt: this.formatDate(provider.updatedAt),
      authorized: authorized ?? null,
    };
  }

  private providerIdHash(providerId: string) {
    return h(providerId);
  }

  async isProviderAuthorized(providerId: string, atTime?: number): Promise<boolean> {
    const when = atTime ?? Math.floor(Date.now() / 1000);
    return this.contract.isProviderAuthorized(this.providerIdHash(providerId), when);
  }

  async providerExists(providerId: string): Promise<boolean> {
    return this.contract.existsProvider(this.providerIdHash(providerId));
  }

  private async fetchProviderByHash(idHash: string, providerIdLabel?: string) {
    const [provider, authorized] = await Promise.all([
      this.contract.getProvider(idHash),
      this.contract.isProviderAuthorized(
        idHash,
        Math.floor(Date.now() / 1000),
      ),
    ]);
    return this.mapProviderStruct(provider, authorized, providerIdLabel);
  }

  async getProvider(providerId: string) {
    const idHash = this.providerIdHash(providerId);
    try {
      const exists = await this.contract.existsProvider(idHash);
      if (!exists) {
        throw new NotFoundException(`Provider "${providerId}" not found`);
      }
      return await this.fetchProviderByHash(idHash, providerId);
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      if (error?.code === 'CALL_EXCEPTION') {
        throw new NotFoundException(`Provider "${providerId}" not found`);
      }
      throw new InternalServerErrorException(
        error?.message || 'Failed to fetch provider',
      );
    }
  }

  private async queryProviderRegisteredEvents() {
    const CHUNK = 99_000;
    const latestBlock = Number(await this.provider.getBlockNumber());
    const startBlock = Math.max(0, latestBlock - 500_000);
    const allEvents: any[] = [];
    const filter = this.contract.filters.ProviderRegistered();

    for (let from = startBlock; from <= latestBlock; from += CHUNK) {
      const to = Math.min(from + CHUNK - 1, latestBlock);
      try {
        const chunk = await this.contract.queryFilter(filter, from, to);
        allEvents.push(...chunk);
      } catch {
        /* skip failed chunk */
      }
    }
    return allEvents;
  }

  async getAllProviders(page = 0, size = 20) {
    try {
      const events = await this.queryProviderRegisteredEvents();
      const seen = new Set<string>();
      const orderedHashes: string[] = [];

      for (const e of events) {
        const hash = e.args.providerIdHash as string;
        if (!seen.has(hash)) {
          seen.add(hash);
          orderedHashes.push(hash);
        }
      }

      const total = orderedHashes.length;
      const totalPages = Math.ceil(total / size) || 1;
      const pageHashes = orderedHashes.slice(page * size, page * size + size);

      const providers = await Promise.all(
        pageHashes.map(async (idHash) => {
          try {
            return await this.fetchProviderByHash(idHash);
          } catch {
            return {
              providerId: this.shortHash(idHash),
              providerIdHash: idHash,
              nameHash: '—',
              level: '—',
              levelHash: '—',
              countyHash: '—',
              facilityType: '—',
              facilityTypeHash: '—',
              status: 'unknown',
              licenseValidFrom: '—',
              licenseValidTo: '—',
              registeredAt: '—',
              updatedAt: '—',
              authorized: null,
            };
          }
        }),
      );

      return {
        providers,
        page: { totalPages, totalElements: total, size, number: page },
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        error?.message || 'Failed to fetch providers',
      );
    }
  }

  async registerProvider(body: {
    providerId: string;
    name: string;
    level: string;
    county: string;
    facilityType: string;
    licenseValidFrom: string;
    licenseValidTo: string;
  }) {
    const licenseFrom = Math.floor(
      new Date(body.licenseValidFrom).getTime() / 1000,
    );
    const licenseTo = Math.floor(
      new Date(body.licenseValidTo).getTime() / 1000,
    );

    const contract = this.connectedContract();
    const tx = await contract.registerProvider(
      h(body.providerId),
      h(body.name),
      h(body.level),
      h(body.county),
      h(body.facilityType),
      licenseFrom,
      licenseTo,
    );
    const receipt = await waitAndAudit('registerProvider', tx, this.provider, {
      contractName: 'ProviderRegistry',
      contractAddress: PROVIDER_REGISTRY_ADDRESS,
      extra: { providerId: body.providerId },
    });

    return { txHash: txHashFromReceipt(receipt), providerId: body.providerId };
  }

  async deregisterProvider(providerId: string) {
    const contract = this.connectedContract();
    const tx = await contract.deregisterProvider(this.providerIdHash(providerId));
    const receipt = await waitAndAudit('deregisterProvider', tx, this.provider, {
      contractName: 'ProviderRegistry',
      contractAddress: PROVIDER_REGISTRY_ADDRESS,
      extra: { providerId },
    });
    return { txHash: txHashFromReceipt(receipt), providerId };
  }

  async suspendProvider(providerId: string) {
    const contract = this.connectedContract();
    const tx = await contract.suspendProvider(this.providerIdHash(providerId));
    const receipt = await waitAndAudit('suspendProvider', tx, this.provider, {
      contractName: 'ProviderRegistry',
      contractAddress: PROVIDER_REGISTRY_ADDRESS,
      extra: { providerId },
    });
    return { txHash: txHashFromReceipt(receipt), providerId };
  }

  async reactivateProvider(providerId: string) {
    const contract = this.connectedContract();
    const tx = await contract.reactivateProvider(this.providerIdHash(providerId));
    const receipt = await waitAndAudit('reactivateProvider', tx, this.provider, {
      contractName: 'ProviderRegistry',
      contractAddress: PROVIDER_REGISTRY_ADDRESS,
      extra: { providerId },
    });
    return { txHash: txHashFromReceipt(receipt), providerId };
  }

  async updateLicense(
    providerId: string,
    licenseValidFrom: string,
    licenseValidTo: string,
  ) {
    const from = Math.floor(new Date(licenseValidFrom).getTime() / 1000);
    const to = Math.floor(new Date(licenseValidTo).getTime() / 1000);
    const contract = this.connectedContract();
    const tx = await contract.updateLicense(
      this.providerIdHash(providerId),
      from,
      to,
    );
    const receipt = await waitAndAudit('updateLicense', tx, this.provider, {
      contractName: 'ProviderRegistry',
      contractAddress: PROVIDER_REGISTRY_ADDRESS,
      extra: { providerId },
    });
    return { txHash: txHashFromReceipt(receipt), providerId };
  }

  async setProviderTier(providerId: string, level: string) {
    const contract = this.connectedContract();
    const tx = await contract.setProviderTier(
      this.providerIdHash(providerId),
      h(level),
    );
    const receipt = await waitAndAudit('setProviderTier', tx, this.provider, {
      contractName: 'ProviderRegistry',
      contractAddress: PROVIDER_REGISTRY_ADDRESS,
      extra: { providerId, level },
    });
    return { txHash: txHashFromReceipt(receipt), providerId, level };
  }

  async getProviderHistory(providerId: string) {
    const idHash = this.providerIdHash(providerId);
    try {
      const exists = await this.contract.existsProvider(idHash);
      if (!exists) {
        throw new NotFoundException(`Provider "${providerId}" not found`);
      }

      const [license, tier, status] = await Promise.all([
        this.contract.getLicenseHistory(idHash),
        this.contract.getTierHistory(idHash),
        this.contract.getStatusHistory(idHash),
      ]);

      return {
        licenseHistory: license.map((e: any) => ({
          validFrom: this.formatDate(e.validFrom),
          validTo: this.formatDate(e.validTo),
          recordedAt: this.formatDate(e.recordedAt),
        })),
        tierHistory: tier.map((e: any) => ({
          level: this.resolveHashedLabel(String(e.levelHash), KNOWN_TIERS),
          levelHash: String(e.levelHash),
            recordedAt: this.formatDate(e.recordedAt),
        })),
        statusHistory: status.map((e: any) => ({
          status: STATUS_MAP[Number(e.status)] || 'unknown',
          recordedAt: this.formatDate(e.recordedAt),
        })),
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error?.message || 'Failed to fetch provider history',
      );
    }
  }
}
