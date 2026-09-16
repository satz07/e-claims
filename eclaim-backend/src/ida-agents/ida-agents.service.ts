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
  }) {
    const page: any = await this.getClient().listAgents({
      labels: query.labels,
      limit: query.limit ?? 50,
    });
    const items = (page.items ?? []).map((a: any) => ({
      name: a.name,
      did: a.id ?? a.did ?? a.agentDid,
      operatorDid: a.operatorDid ?? a.operator,
      labels: a.labels,
      autonomyLevel: a.autonomyLevel,
      trustScore: a.trustScore,
    }));
    return {
      totalCount: page.totalCount ?? items.length,
      items,
    };
  }
}
