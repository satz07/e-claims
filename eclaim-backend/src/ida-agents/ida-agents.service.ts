import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IDAClient } from '@myida/sdk';
import { Wallet } from 'ethers';
import {
  EntityType,
  getEntityAgent,
  listEntityAgents,
  rememberEntityAgent,
} from './entity-agent-links';

@Injectable()
export class IdaAgentsService implements OnModuleInit {
  private readonly logger = new Logger(IdaAgentsService.name);
  private client: IDAClient | null = null;
  private signerKey: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    try {
      this.client = this.buildClient();
      const key =
        this.config.get<string>('IDA_SIGNER_PRIVATE_KEY') ||
        this.config.get<string>('OWNER_PRIVATE_KEY') ||
        '';
      this.signerKey = key
        ? key.startsWith('0x')
          ? key
          : `0x${key}`
        : null;
      if (this.signerKey) {
        const addr = new Wallet(this.signerKey).address;
        this.logger.log(`IDA signer wallet: ${addr}`);
      } else {
        this.logger.warn(
          'IDA_SIGNER_PRIVATE_KEY / OWNER_PRIVATE_KEY not set — registerAgent on-chain will fail',
        );
      }
    } catch (e: any) {
      this.logger.warn(`IDA client init deferred: ${e?.message || e}`);
    }
  }

  private buildClient(): IDAClient {
    const apiUrl = (
      this.config.get<string>('IDA_API_URL') ||
      'http://localhost:8080'
    ).replace(/\/$/, '');
    const apiKey =
      this.config.get<string>('IDA_API_KEY') || 'dev-api-key';
    const rpcUrl =
      this.config.get<string>('IDA_RPC_URL') ||
      this.config.get<string>('APEIRO_RPC_URL') ||
      this.config.get<string>('ECLAIM_RPC_URL') ||
      'https://rpc.adifoundation.ai/';
    const chainId = Number(
      this.config.get<string>('IDA_CHAIN_ID') || '36900',
    );
    const didRegistry =
      this.config.get<string>('IDA_DID_REGISTRY') ||
      '0xa867Be733ab382a3491bC2A3Bff95F98eEb403b1';
    const agentTrustRegistry =
      this.config.get<string>('IDA_AGENT_TRUST_REGISTRY') ||
      '0xAb8066df5D28a924a079Fc47Fa7b4ad338FA160B';

    return new IDAClient({
      apiUrl,
      apiKey,
      chain: {
        rpcUrl,
        chainId,
        didRegistry,
        agentTrustRegistry,
      },
    });
  }

  private getClient(): IDAClient {
    if (!this.client) this.client = this.buildClient();
    return this.client;
  }

  private getDefaultOperatorDid(): string {
    const fromEnv = (this.config.get<string>('IDA_OPERATOR_DID') || '').trim();
    if (fromEnv) return fromEnv;
    if (this.signerKey) {
      try {
        const addr = new Wallet(this.signerKey).address.toLowerCase();
        const chainId =
          this.config.get<string>('IDA_CHAIN_ID') || '37001';
        return `did:adi:${chainId}:${addr}`;
      } catch {
        /* fall through */
      }
    }
    return 'did:adi:37001:0xcb01d9dec076837ef915e0ffd8d9182264fc5fae';
  }

  getConfigSummary() {
    const c = this.getClient() as any;
    const cfg = c.config || {};
    let signerAddress: string | null = null;
    if (this.signerKey) {
      try {
        signerAddress = new Wallet(this.signerKey).address;
      } catch {
        /* ignore */
      }
    }
    return {
      apiUrl: cfg.apiUrl,
      chainId: cfg.chain?.chainId,
      rpcUrl: cfg.chain?.rpcUrl,
      didRegistry: cfg.chain?.didRegistry,
      agentTrustRegistry: cfg.chain?.agentTrustRegistry,
      signerAddress,
      registerSignsOnBackend: true,
      operatorDid: this.getDefaultOperatorDid(),
    };
  }

  async createOperatorDid() {
    const result: any = await this.getClient().createDID({
      keyType: 'ed25519',
    });
    return {
      operatorDid: result.did ?? result.id,
      // private key only if API returns it — store securely client-side if needed
      privateKeyHex:
        result.privateKeyHex ?? result.privateKey ?? undefined,
    };
  }

  async provisionAgent(body: {
    name?: string;
    operatorDid?: string;
    sponsorDid?: string;
    platform?: string;
    autonomyLevel?: number;
    labels?: Record<string, string>;
  }) {
    let operatorDid = (body.operatorDid || '').trim();
    let operatorMinted: any = null;
    if (!operatorDid) {
      operatorMinted = await this.createOperatorDid();
      operatorDid = operatorMinted.operatorDid;
    }

    const name = (body.name || 'E-claims Agent').trim();
    const agent: any = await this.getClient().provisionAgent({
      name,
      operatorDid,
      sponsorDid: (body.sponsorDid || operatorDid).trim(),
      platform: body.platform || 'eclaims',
      autonomyLevel: body.autonomyLevel ?? 0,
      labels: body.labels || { app: 'eclaims' },
      modelInfo: {
        provider: 'OpenAI',
        name: 'gpt-4o',
        version: '2026-01',
      },
      capabilities: [
        {
          name: 'eclaims.anchor',
          description: 'Anchor claims on Apeiro L3',
        },
      ],
    });

    return {
      operatorDid,
      agentDid: agent.agentDid,
      trustScore: agent.trustScore,
      autonomyLevel: agent.autonomyLevel,
      permissions: agent.permissions,
      // one-time key — show once in UI
      ibctSigningKeyHex: agent.ibctSigningKeyHex,
      operatorMinted: operatorMinted
        ? { operatorDid: operatorMinted.operatorDid }
        : undefined,
      raw: agent,
    };
  }

  async provisionAndRegister(body: {
    name?: string;
    entityType?: EntityType;
    entityId?: string;
    operatorDid?: string;
    platform?: string;
    autonomyLevel?: number;
    labels?: Record<string, string>;
  }) {
    const entityType = body.entityType;
    const entityId = (body.entityId || '').trim();
    if (entityType && !entityId) {
      throw new BadRequestException('entityId is required when entityType is set');
    }

    const operatorDid = (body.operatorDid || '').trim() || this.getDefaultOperatorDid();
    const name =
      (body.name || '').trim() ||
      (entityType && entityId ? `${entityType} ${entityId}` : 'E-claims Agent');

    const labels: Record<string, string> = {
      app: 'eclaims',
      ...(body.labels || {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
    };

    const provision = await this.provisionAgent({
      name,
      operatorDid,
      platform: body.platform || 'eclaims',
      autonomyLevel: body.autonomyLevel ?? 0,
      labels,
    });

    const register = await this.registerAgent({
      operatorDid: provision.operatorDid,
      agentDid: provision.agentDid,
      name,
    });

    let entityLink = null as ReturnType<typeof rememberEntityAgent> | null;
    if (entityType && entityId) {
      entityLink = rememberEntityAgent({
        entityType,
        entityId,
        name,
        operatorDid: provision.operatorDid,
        agentDid: provision.agentDid,
        trustScore: provision.trustScore,
        autonomyLevel: provision.autonomyLevel,
        labels,
        registerTxHash: register.txHash,
        registerBlockNumber: register.blockNumber,
        ibctSigningKeyHex: provision.ibctSigningKeyHex,
      });
    }

    return {
      operatorDid: provision.operatorDid,
      agentDid: provision.agentDid,
      name,
      entityType: entityType || null,
      entityId: entityId || null,
      trustScore: provision.trustScore,
      autonomyLevel: provision.autonomyLevel,
      labels,
      ibctSigningKeyHex: provision.ibctSigningKeyHex,
      registerTxHash: register.txHash,
      registerBlockNumber: register.blockNumber,
      signerAddress: register.signerAddress,
      provision,
      register,
      entityLink,
    };
  }

  async registerAgent(body: {
    operatorDid: string;
    agentDid?: string;
    name?: string;
  }) {
    const operatorDid = (body.operatorDid || '').trim().replace(/\s+/g, '');
    if (!operatorDid) {
      throw new BadRequestException('operatorDid is required');
    }
    if (!this.signerKey) {
      throw new InternalServerErrorException(
        'Backend signer not configured (set IDA_SIGNER_PRIVATE_KEY or OWNER_PRIVATE_KEY)',
      );
    }

    const agentDid = (
      (body.agentDid || '').trim().replace(/\s+/g, '') ||
      `did:adi:agent-eclaims-${Date.now()}`
    );
    const name = (body.name || 'E-claims Agent').trim();
    // Pass hex key string — SDK resolveSigner attaches JsonRpcProvider.
    // A bare Wallet() has no provider → "missing provider" on sendTransaction.
    const signerAddress = new Wallet(this.signerKey).address;

    try {
      const result: any = await this.getClient().registerAgent(
        {
          operator: operatorDid,
          name,
          modelInfo: {
            provider: 'OpenAI',
            name: 'gpt-4o',
            version: '2026-01',
          },
          capabilities: ['eclaims.anchor'],
        },
        { signer: this.signerKey, agentDid },
      );

      return {
        operatorDid,
        agentDid,
        signerAddress,
        txHash: result?.txHash,
        blockNumber: result?.blockNumber,
        raw: result,
        note: 'Signed on backend (no MetaMask)',
      };
    } catch (e: any) {
      const msg =
        e?.shortMessage ||
        e?.reason ||
        e?.info?.error?.message ||
        e?.message ||
        String(e);
      this.logger.error(`registerAgent failed: ${msg}`);
      throw new InternalServerErrorException(msg);
    }
  }

  async listAgents(query: {
    limit?: number;
    labels?: Record<string, string>;
    entityType?: EntityType;
  }) {
    const page: any = await this.getClient().listAgents({
      labels: query.labels,
      limit: query.limit ?? 200,
    });
    const local = listEntityAgents();
    const localByDid = new Map(local.map((r) => [r.agentDid, r]));

    const items = (page.items ?? []).map((a: any) => {
      const did = a.id ?? a.did ?? a.agentDid;
      const link = localByDid.get(did);
      return {
        name: a.name,
        did,
        operatorDid: a.operatorDid ?? a.operator,
        labels: a.labels,
        autonomyLevel: a.autonomyLevel,
        trustScore: a.trustScore,
        entityType: link?.entityType ?? a.labels?.entityType ?? null,
        entityId: link?.entityId ?? a.labels?.entityId ?? null,
        createdAt: link?.createdAt ?? null,
        registerTxHash: link?.registerTxHash ?? null,
        registerBlockNumber: link?.registerBlockNumber ?? null,
      };
    });

    let filtered = items;
    if (query.entityType) {
      filtered = items.filter(
        (i) => i.entityType === query.entityType,
      );
    }

    return {
      totalCount: page.totalCount ?? filtered.length,
      items: filtered,
      operatorDid: this.getDefaultOperatorDid(),
    };
  }

  listEntityAgents(entityType?: EntityType) {
    const rows = listEntityAgents();
    const filtered = entityType
      ? rows.filter((r) => r.entityType === entityType)
      : rows;
    return {
      totalCount: filtered.length,
      operatorDid: this.getDefaultOperatorDid(),
      items: filtered,
    };
  }

  getEntityAgent(entityType: EntityType, entityId: string) {
    const row = getEntityAgent(entityType, entityId);
    if (!row) {
      return { found: false as const, entityType, entityId };
    }
    return { found: true as const, ...row };
  }
}
