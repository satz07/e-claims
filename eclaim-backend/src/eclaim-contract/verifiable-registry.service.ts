import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ethers } from 'ethers';
import * as ABI from './VERIFIABLE_REGISTRY.json';
import { txHashFromReceipt } from './tx-receipt.util';
import { getActiveChain } from './chain-config';
import { waitAndAudit } from './tx-audit-log';
import { rememberId, resolveIdLabel } from './registry-id-labels';
import { withChainWriteLock } from './chain-write-lock';

const RPC_URL = getActiveChain().rpcUrl;

export type RegistryKind = 'citizen' | 'clinician' | 'insurer';

const ENV_KEYS: Record<RegistryKind, string> = {
  citizen: 'CITIZEN_REGISTRY_ADDRESS',
  clinician: 'CLINICIAN_REGISTRY_ADDRESS',
  insurer: 'INSURER_REGISTRY_ADDRESS',
};

const STATUS_MAP: Record<number, string> = {
  0: 'registered',
  1: 'deregistered',
  2: 'suspended',
  3: 'expired',
};

const ZERO_HASH = '0x' + '00'.repeat(32);

function h(s: string): string {
  if (!s) return ZERO_HASH;
  return ethers.keccak256(ethers.toUtf8Bytes(s));
}

@Injectable()
export class VerifiableRegistryService {
  private provider = new ethers.JsonRpcProvider(RPC_URL);
  private contracts = new Map<RegistryKind, ethers.Contract>();

  isConfigured(kind: RegistryKind): boolean {
    const addr = process.env[ENV_KEYS[kind]];
    return Boolean(addr && addr !== '0x' && addr.length > 10);
  }

  addressFor(kind: RegistryKind): string | null {
    return process.env[ENV_KEYS[kind]] || null;
  }

  private contractFor(kind: RegistryKind): ethers.Contract {
    const cached = this.contracts.get(kind);
    if (cached) return cached;

    const address = this.addressFor(kind);
    if (!address) {
      throw new InternalServerErrorException(
        `${ENV_KEYS[kind]} is not configured`,
      );
    }
    const contract = new ethers.Contract(address, ABI.abi, this.provider);
    this.contracts.set(kind, contract);
    return contract;
  }

  private getSigner() {
    const key = process.env.OWNER_PRIVATE_KEY || '';
    if (!key) {
      throw new InternalServerErrorException('OWNER_PRIVATE_KEY not configured');
    }
    return new ethers.Wallet(key, this.provider);
  }

  private connected(kind: RegistryKind) {
    return this.contractFor(kind).connect(this.getSigner()) as ethers.Contract;
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

  private mapEntry(entry: any, idLabel?: string, authorized?: boolean) {
    return {
      id: idLabel || this.shortHash(String(entry.idHash)),
      idHash: String(entry.idHash),
      metaHash: String(entry.metaHash),
      status: STATUS_MAP[Number(entry.status)] || 'unknown',
      validFrom: this.formatDate(entry.validFrom),
      validTo: this.formatDate(entry.validTo),
      registeredAt: this.formatDate(entry.registeredAt),
      updatedAt: this.formatDate(entry.updatedAt),
      authorized: authorized ?? null,
    };
  }

  async isAuthorized(
    kind: RegistryKind,
    id: string,
    atTime?: number,
  ): Promise<boolean> {
    if (!this.isConfigured(kind)) return true;
    const when = atTime ?? Math.floor(Date.now() / 1000);
    return this.contractFor(kind).isAuthorized(h(id), when);
  }

  async exists(kind: RegistryKind, id: string): Promise<boolean> {
    if (!this.isConfigured(kind)) return false;
    return this.contractFor(kind).existsEntry(h(id));
  }

  async getEntry(kind: RegistryKind, id: string) {
    const idHash = h(id);
    try {
      const exists = await this.contractFor(kind).existsEntry(idHash);
      if (!exists) {
        throw new NotFoundException(`${kind} entry "${id}" not found`);
      }
      const [entry, authorized] = await Promise.all([
        this.contractFor(kind).getEntry(idHash),
        this.contractFor(kind).isAuthorized(idHash, Math.floor(Date.now() / 1000)),
      ]);
      return this.mapEntry(entry, id, authorized);
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      if (error?.code === 'CALL_EXCEPTION') {
        throw new NotFoundException(`${kind} entry "${id}" not found`);
      }
      throw new InternalServerErrorException(
        error?.message || `Failed to fetch ${kind} entry`,
      );
    }
  }

  private async queryRegisteredEvents(kind: RegistryKind) {
    const CHUNK = 99_000;
    const latestBlock = Number(await this.provider.getBlockNumber());
    const startBlock = Math.max(0, latestBlock - 500_000);
    const allEvents: any[] = [];
    const filter = this.contractFor(kind).filters.EntryRegistered();

    for (let from = startBlock; from <= latestBlock; from += CHUNK) {
      const to = Math.min(from + CHUNK - 1, latestBlock);
      try {
        const chunk = await this.contractFor(kind).queryFilter(filter, from, to);
        allEvents.push(...chunk);
      } catch {
        /* skip failed chunk */
      }
    }
    return allEvents;
  }

  async list(kind: RegistryKind, page = 0, size = 20) {
    if (!this.isConfigured(kind)) {
      return {
        entries: [],
        page: { totalPages: 0, totalElements: 0, size, number: page },
        configured: false,
      };
    }

    try {
      const events = await this.queryRegisteredEvents(kind);
      const seen = new Set<string>();
      const orderedHashes: string[] = [];

      for (const e of events) {
        const hash = e.args.idHash as string;
        if (!seen.has(hash)) {
          seen.add(hash);
          orderedHashes.push(hash);
        }
      }

      // Newest registrations first
      orderedHashes.reverse();

      const total = orderedHashes.length;
      const totalPages = Math.ceil(total / size) || 1;
      const pageHashes = orderedHashes.slice(page * size, page * size + size);

      const entries = await Promise.all(
        pageHashes.map(async (idHash) => {
          try {
            const [entry, authorized] = await Promise.all([
              this.contractFor(kind).getEntry(idHash),
              this.contractFor(kind).isAuthorized(
                idHash,
                Math.floor(Date.now() / 1000),
              ),
            ]);
            return this.mapEntry(
              entry,
              resolveIdLabel(kind, idHash) || this.shortHash(idHash),
              authorized,
            );
          } catch {
            return {
              id: this.shortHash(idHash),
              idHash,
              metaHash: '—',
              status: 'unknown',
              validFrom: '—',
              validTo: '—',
              registeredAt: '—',
              updatedAt: '—',
              authorized: null,
            };
          }
        }),
      );

      return {
        entries,
        configured: true,
        page: { totalPages, totalElements: total, size, number: page },
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        error?.message || `Failed to list ${kind} entries`,
      );
    }
  }

  async rememberPlainId(kind: RegistryKind, id: string) {
    if (!id?.trim()) {
      throw new BadRequestException('id is required');
    }
    rememberId(kind, id.trim());
    return { ok: true, kind, id: id.trim(), idHash: h(id.trim()) };
  }

  async register(
    kind: RegistryKind,
    body: {
      id: string;
      meta?: string;
      validFrom: string;
      validTo: string;
    },
  ) {
    return withChainWriteLock(async () => {
      rememberId(kind, body.id);
      const idHash = h(body.id);
      const now = Math.floor(Date.now() / 1000);
      try {
        const authorized = await this.contractFor(kind).isAuthorized(idHash, now);
        if (authorized) {
          return {
            txHash: null,
            id: body.id,
            kind,
            alreadyRegistered: true,
          };
        }
      } catch {
        /* fall through and attempt register */
      }

      const from = Math.floor(new Date(body.validFrom).getTime() / 1000);
      const to = Math.floor(new Date(body.validTo).getTime() / 1000);
      const contract = this.connected(kind);
      try {
        const tx = await contract.register(
          idHash,
          h(body.meta || ''),
          from,
          to,
        );
        const receipt = await waitAndAudit(`${kind}.register`, tx, this.provider, {
          contractName: 'VerifiableRegistry',
          contractAddress: this.addressFor(kind),
          extra: { kind, id: body.id },
        });
        return { txHash: txHashFromReceipt(receipt), id: body.id, kind };
      } catch (error: any) {
        const msg = String(
          error?.reason || error?.shortMessage || error?.message || '',
        );
        if (/Already active/i.test(msg)) {
          return {
            txHash: null,
            id: body.id,
            kind,
            alreadyRegistered: true,
          };
        }
        throw new InternalServerErrorException(msg || `Failed to register ${kind}`);
      }
    });
  }

  async suspend(kind: RegistryKind, id: string) {
    return withChainWriteLock(async () => {
      const contract = this.connected(kind);
      const tx = await contract.suspend(h(id));
      const receipt = await waitAndAudit(`${kind}.suspend`, tx, this.provider, {
        contractName: 'VerifiableRegistry',
        contractAddress: this.addressFor(kind),
        extra: { kind, id },
      });
      return { txHash: txHashFromReceipt(receipt), id, kind };
    });
  }

  async reactivate(kind: RegistryKind, id: string) {
    return withChainWriteLock(async () => {
      const contract = this.connected(kind);
      const tx = await contract.reactivate(h(id));
      const receipt = await waitAndAudit(`${kind}.reactivate`, tx, this.provider, {
        contractName: 'VerifiableRegistry',
        contractAddress: this.addressFor(kind),
        extra: { kind, id },
      });
      return { txHash: txHashFromReceipt(receipt), id, kind };
    });
  }

  async deregister(kind: RegistryKind, id: string) {
    return withChainWriteLock(async () => {
      const contract = this.connected(kind);
      const tx = await contract.deregister(h(id));
      const receipt = await waitAndAudit(`${kind}.deregister`, tx, this.provider, {
        contractName: 'VerifiableRegistry',
        contractAddress: this.addressFor(kind),
        extra: { kind, id },
      });
      return { txHash: txHashFromReceipt(receipt), id, kind };
    });
  }
}
