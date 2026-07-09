// wallet.service.ts
import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DfnsApiClient } from '@dfns/sdk';
import { AsymmetricKeySigner } from '@dfns/sdk-keysigner';

import { SignedPostDto } from './dto/signed-post.dto';
import { CustomCreateWalletDto } from './dto/custom-create-wallet.dto';
import { CreateAdiWalletDto } from './dto/create-adi-wallet.dto';
import { CreateSwapDto, CreateSwapQuoteDto } from './dto/swap-dtos';
import { CreateOrgWalletDto } from './dto/create-org-wallet.dto';

import { parseDFNSToken } from '../utils/parseDFNSToken/parseDFNSToken';
import { ConfigService } from '@nestjs/config';
import { AllConfigType, DfnsConfig } from 'src/config/config.type';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from 'src/database/entities/wallet.entity';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly dfns: DfnsApiClient;
  private readonly signer: AsymmetricKeySigner;
  private readonly dfnsConfig: DfnsConfig;

  @InjectRepository(Wallet)
  private readonly walletRepo: Repository<Wallet>;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    this.dfnsConfig = this.configService.get('dfns', {
      infer: true,
    }) as DfnsConfig;

    if (!this.dfnsConfig) {
      throw new Error('DFNS configuration is missing');
    }

    this.signer = new AsymmetricKeySigner({
      credId: this.dfnsConfig.serviceAccountCredentialId,
      privateKey: this.dfnsConfig.serviceAccountPrivateKey,
    });

    this.dfns = new DfnsApiClient({
      baseUrl: this.dfnsConfig.baseUrl,
      orgId: this.dfnsConfig.orgId,
      authToken: this.dfnsConfig.authToken,
      signer: this.signer,
    });
  }

  async getWalletByUserIdDB(userId: number): Promise<Wallet | null> {
    if (!userId) return null;

    return this.walletRepo.findOne({
      where: { userId },
    });
  }
  async createAdiTestnetWallet(body?: CreateAdiWalletDto) {
    const path = body?.httpPath ?? '/wallets';
    const payload: Record<string, unknown> = { network: 'AdiTestnet' };

    if (body?.name) payload.name = body.name;
    if (body?.createdByOrgUserId) {
      payload.tags = [`creator:${body.createdByOrgUserId}`];
    }

    const enforce = (this.dfnsConfig as any).enforceEndUserWallets === true;

    if (body?.delegateTo) payload.delegateTo = body.delegateTo;

    if (body?.token && !payload.delegateTo) {
      const info = parseDFNSToken(body.token);
      if (info?.userId) payload.delegateTo = info.userId;
    }

    if (!payload.delegateTo && enforce) {
      throw new BadRequestException(
        'User delegation is required. Provide delegateTo or a DFNS user token.',
      );
    }

    return this.signedPost(path, payload);
  }

  async createEthereumSepoliaWallet(body?: CreateAdiWalletDto) {
    const path = body?.httpPath ?? '/wallets';
    const payload: Record<string, unknown> = { network: 'EthereumSepolia' };

    if (body?.name) payload.name = body.name;
    if (body?.createdByOrgUserId) {
      payload.tags = [`creator:${body.createdByOrgUserId}`];
    }

    const enforce = (this.dfnsConfig as any).enforceEndUserWallets === true;

    if (body?.delegateTo) payload.delegateTo = body.delegateTo;

    if (body?.token && !payload.delegateTo) {
      const info = parseDFNSToken(body.token);
      if (info?.userId) payload.delegateTo = info.userId;
    }

    if (!payload.delegateTo && enforce) {
      throw new BadRequestException(
        'User delegation is required. Provide delegateTo or a DFNS user token.',
      );
    }

    return this.signedPost(path, payload);
  }

  async createPolygonAmoyWallet(body?: CreateAdiWalletDto) {
    const path = body?.httpPath ?? '/wallets';
    const payload: Record<string, unknown> = { network: 'PolygonAmoy' };

    if (body?.name) payload.name = body.name;
    if (body?.createdByOrgUserId) {
      payload.tags = [`creator:${body.createdByOrgUserId}`];
    }

    const enforce = (this.dfnsConfig as any).enforceEndUserWallets === true;

    if (body?.delegateTo) payload.delegateTo = body.delegateTo;

    if (body?.token && !payload.delegateTo) {
      const info = parseDFNSToken(body.token);
      if (info?.userId) payload.delegateTo = info.userId;
    }

    if (!payload.delegateTo && enforce) {
      throw new BadRequestException(
        'User delegation is required. Provide delegateTo or a DFNS user token.',
      );
    }

    return this.signedPost(path, payload);
  }

  async createOrgWallet(body: CreateOrgWalletDto) {
    if (!body?.network) {
      throw new BadRequestException('network is required');
    }

    if (!body?.name) {
      throw new BadRequestException('name is required');
    }

    const payload: Record<string, unknown> = {
      network: body.network,
      name: body.name,
    };

    const tags: string[] = ['autogastopup'];

    if (body.userId) {
      tags.push(`creator:${body.userId}`);
      // payload.tags = [`creator:${body.userId}`];
    }
    payload.tags = tags;

    return this.signedPost('/wallets', payload);
  }

  async createWalletCustom(body: CustomCreateWalletDto) {
    const path = body.httpPath ?? '/wallets';

    if (!/^\/(custody\/)?wallets$/.test(path)) {
      throw new BadRequestException(
        "Invalid httpPath for create wallet. Use '/wallets' or '/custody/wallets'",
      );
    }

    const payload: Record<string, unknown> = {
      network: body.network,
      name: body.name,
      signingKey: body.signingKey,
      delegateTo: body.delegateTo,
      delayDelegation: body.delayDelegation,
      externalId: body.externalId,
      tags: body.tags,
      validatorId: body.validatorId,
    };

    if (body.createdByOrgUserId) {
      const tags = Array.isArray(payload.tags)
        ? ([...payload.tags] as string[])
        : [];
      const marker = `creator:${body.createdByOrgUserId}`;

      if (!tags.includes(marker)) tags.push(marker);
      payload.tags = tags;
    }

    const enforce = (this.dfnsConfig as any).enforceEndUserWallets === true;

    if (body.token && !payload.delegateTo) {
      const info = parseDFNSToken(body.token);
      if (info?.userId) payload.delegateTo = info.userId;
    }

    if (!body.network) {
      throw new BadRequestException('network is required');
    }

    if (body.signingKey) {
      const { id, scheme, curve, storeId } = body.signingKey as Record<
        string,
        unknown
      > as {
        id?: string;
        scheme?: string;
        curve?: string;
        storeId?: string;
      };

      if (id) {
        if (scheme || curve || storeId) {
          this.logger.warn(
            'createWalletCustom: signingKey.id provided — ignoring scheme/curve/storeId',
          );
        }

        payload.signingKey = { id };
      } else {
        const evmNetworks = new Set([
          'Ethereum',
          'EthereumSepolia',
          'EthereumHolesky',
          'Polygon',
          'PolygonAmoy',
          'Optimism',
          'OptimismSepolia',
          'ArbitrumOne',
          'ArbitrumSepolia',
          'Base',
          'BaseSepolia',
          'Bsc',
          'AvalancheC',
          'FantomOpera',
        ]);

        if (evmNetworks.has(body.network)) {
          if (scheme && scheme !== 'ECDSA') {
            throw new BadRequestException(
              "For EVM networks, signingKey.scheme must be 'ECDSA'",
            );
          }

          if (curve && curve !== 'secp256k1') {
            throw new BadRequestException(
              "For EVM networks, signingKey.curve must be 'secp256k1'",
            );
          }
        }
      }
    }

    if (body.delegateTo && body.delayDelegation) {
      this.logger.warn(
        "createWalletCustom: both 'delegateTo' and 'delayDelegation' provided — preferring 'delegateTo'",
      );
      delete payload.delayDelegation;
    }

    if (body.validatorId && !/^Canton/.test(body.network)) {
      this.logger.warn(
        'createWalletCustom: validatorId ignored because network is not Canton',
      );
      delete payload.validatorId;
    }

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    if (!payload.delegateTo && enforce) {
      throw new BadRequestException(
        'User delegation is required. Provide delegateTo or a DFNS user token.',
      );
    }

    return this.signedPost(path, payload);
  }

  private async signedPost(path: string, payload: Record<string, unknown>) {
    const method = 'POST';
    let challengeRes: any;

    try {
      challengeRes = await this.dfns.auth.createUserActionChallenge({
        body: {
          userActionServerKind: 'Api',
          userActionHttpMethod: method,
          userActionHttpPath: path,
          userActionPayload: JSON.stringify(payload ?? {}),
        },
      });
    } catch (e: any) {
      const raw = String(e?.message ?? e);
      const status = /path not found/i.test(raw) ? 404 : 400;

      this.logger.error(`DFNS challenge failed for ${path}: ${raw}`);

      throw new HttpException(
        { message: this.extractDfnsMessage(raw) },
        status,
      );
    }

    const firstFactor = await this.signer.sign(challengeRes);

    let sigRes: any;
    try {
      sigRes = await this.dfns.auth.createUserActionSignature({
        body: {
          challengeIdentifier: challengeRes.challengeIdentifier,
          firstFactor,
        },
      });
    } catch (e: any) {
      const raw = String(e?.message ?? e);

      this.logger.error(
        `DFNS user-action signature failed for ${path}: ${raw}`,
      );

      throw new HttpException({ message: this.extractDfnsMessage(raw) }, 400);
    }

    const res = await fetch(`${this.dfnsConfig.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.dfnsConfig.authToken}`,
        'Content-Type': 'application/json',
        'X-DFNS-USERACTION': sigRes.userAction,
      },
      body: JSON.stringify(payload ?? {}),
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      const msg = this.extractDfnsMessage(raw);

      this.logger.error(`DFNS POST ${path} failed: ${res.status} ${msg}`);

      throw new HttpException({ message: msg }, res.status);
    }

    return res.json();
  }

  private async plainGet(path: string, query?: Record<string, unknown>) {
    const url = new URL(`${this.dfnsConfig.baseUrl}${path}`);

    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.set(key, String(value));
    });

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.dfnsConfig.authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      const msg = this.extractDfnsMessage(raw);

      this.logger.error(`DFNS GET ${path} failed: ${res.status} ${msg}`);

      throw new HttpException({ message: msg }, res.status);
    }

    const raw = await res.text().catch(() => '');
    if (!raw) return {};

    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }

  private extractItems<T = any>(res: any): T[] {
    if (Array.isArray(res?.items)) return res.items;
    if (Array.isArray(res)) return res;
    return [];
  }

  async listNetworkFees(network: string) {
    if (!network) {
      throw new BadRequestException('network is required');
    }

    return this.plainGet('/networks/fees', { network });
  }

  async listWallets(query?: Record<string, unknown>) {
    return this.plainGet('/wallets', query);
  }

  async getAllWallets() {
    try {
      const res = await this.plainGet('/wallets');
      return { items: this.extractItems(res) };
    } catch (error: any) {
      this.logger.error(
        'Failed to fetch all wallets',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async listWalletsByUser(userId: string | number) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const res = await this.plainGet('/wallets');
    const items = this.extractItems(res);
    const creatorTag = `creator:${userId}`;

    const filtered = items.filter(
      (wallet: any) =>
        Array.isArray(wallet?.tags) && wallet.tags.includes(creatorTag),
    );

    const mineWallets = Array.isArray((res as any)?.items)
      ? { ...(res as any), items: filtered }
      : { items: filtered };

    mineWallets.items = await Promise.all(
      mineWallets.items.map(async (wallet: any) => {
        const walletDetail = await this.getWalletAssets(wallet.id);
        return { ...wallet, walletDetail };
      }),
    );

    return mineWallets;
  }

  async listWalletsByOrgUser(orgUserId: string) {
    if (!orgUserId) {
      throw new BadRequestException('orgUserId is required');
    }

    const res = await this.plainGet('/wallets');
    const items = this.extractItems(res);
    const marker = `creator:${orgUserId}`;

    const filtered = items.filter((wallet: any) =>
      Array.isArray(wallet?.tags) ? wallet.tags.includes(marker) : false,
    );

    return Array.isArray((res as any)?.items)
      ? { ...(res as any), items: filtered }
      : filtered;
  }

  async userWalletCreation(userId: number) {
    if (!userId) {
      throw new BadRequestException('Invalid token: no userId found');
    }

    const walletName = `wallet-${userId}`;

    const createdWallet = await this.createOrgWallet({
      network: (this.dfnsConfig as any).network,
      // network: 'AdiTestnet',
      name: walletName,
      userId,
    });

    console.log('Created wallet from DFNS:', createdWallet);
    const walletId =
      createdWallet?.id ||
      createdWallet?.walletId ||
      createdWallet?.data?.id ||
      null;
    console.log('Extracted walletId:', walletId);

    const address =
      createdWallet?.address || createdWallet?.data?.address || null;
    console.log('Extracted address:', address);
    if (!walletId) {
      throw new InternalServerErrorException(
        'Wallet provider did not return walletId',
      );
    }

    return {
      walletId,
      address,
      created: true,
    };
  }

  async getWallet(walletId: string) {
    if (!walletId) {
      throw new BadRequestException('walletId is required');
    }

    return this.plainGet(`/wallets/${walletId}`);
  }

  async getWalletHistory(walletId: string, query?: Record<string, unknown>) {
    if (!walletId) {
      throw new BadRequestException('walletId is required');
    }

    const limit =
      query && typeof query.limit !== 'undefined'
        ? Number(query.limit)
        : undefined;

    const pageNumber =
      query && typeof query.pageNumber !== 'undefined'
        ? Number(query.pageNumber)
        : 1;

    const pageToken =
      query && typeof query.pageToken !== 'undefined'
        ? String(query.pageToken)
        : undefined;

    if (!Number.isFinite(limit) || limit === undefined) {
      return this.plainGet(`/wallets/${walletId}/history`, query);
    }

    if (pageNumber > 1 && !pageToken) {
      throw new BadRequestException(
        'pageToken is required for pageNumber > 1 (use nextPageToken from previous response)',
      );
    }

    const dfnsQuery: Record<string, unknown> = { limit };
    if (pageToken) dfnsQuery.paginationToken = pageToken;

    let res = await this.plainGet(`/wallets/${walletId}/history`, dfnsQuery);
    const direction =
      query && typeof query.direction !== 'undefined'
        ? String(query.direction).toLowerCase()
        : undefined;

    const items = this.extractItems(res);
    let filteredItems =
      direction === 'in' || direction === 'out'
        ? items.filter(
            (item: any) =>
              String(item?.direction || '').toLowerCase() === direction,
          )
        : items;

    let nextPageToken = (res as any)?.nextPageToken ?? null;

    if (direction === 'in' || direction === 'out') {
      while (nextPageToken && filteredItems.length < limit) {
        const nextRes = await this.plainGet(`/wallets/${walletId}/history`, {
          limit,
          paginationToken: nextPageToken,
        });

        const nextItems = this.extractItems(nextRes);
        const nextFiltered = nextItems.filter(
          (item: any) =>
            String(item?.direction || '').toLowerCase() === direction,
        );

        filteredItems = filteredItems.concat(nextFiltered);
        nextPageToken = (nextRes as any)?.nextPageToken ?? null;
        res = nextRes;
      }

      if (filteredItems.length > limit) {
        filteredItems = filteredItems.slice(0, limit);
      }
    }

    const safePage =
      Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
    const nextPageNumber = nextPageToken ? safePage + 1 : null;

    let totalPages: number | null = null;
    if (!nextPageToken) {
      totalPages = Math.ceil(filteredItems.length / limit) || 1;
    }

    return {
      ...(res as any),
      items: filteredItems,
      pagination: {
        total: filteredItems.length,
        limit,
        pageNumber: safePage,
        totalPages,
        nextPageNumber,
        nextPageToken,
      },
    };
  }

  async getWalletTransfers(walletId: string, query?: Record<string, unknown>) {
    if (!walletId) {
      throw new BadRequestException('walletId is required');
    }

    return this.plainGet(`/wallets/${walletId}/transfers`, query);
  }

  async getWalletTransfer(walletId: string, transferId: string) {
    if (!walletId) {
      throw new BadRequestException('walletId is required');
    }

    if (!transferId) {
      throw new BadRequestException('transferId is required');
    }

    return this.plainGet(`/wallets/${walletId}/transfers/${transferId}`);
  }

  async delegateWallet(walletId: string, userId: string) {
    if (!walletId) {
      throw new BadRequestException('walletId is required');
    }

    if (!userId || !userId.startsWith('us-')) {
      throw new BadRequestException(
        'Valid DFNS end-user id (us-...) is required',
      );
    }

    return this.signedPost(`/wallets/${walletId}/delegate`, { userId });
  }

  async getWalletAssets(walletId: string, query?: Record<string, unknown>) {
    if (!walletId) {
      throw new BadRequestException('walletId is required');
    }

    const res = await this.plainGet(`/wallets/${walletId}/assets`, query);
    const assets = Array.isArray((res as any)?.assets)
      ? (res as any).assets
      : [];

    const mapped = assets.map((asset: any) => {
      const symbol = asset?.metadata?.asset?.symbol ?? asset?.symbol;
      const decimals = Number(
        asset?.metadata?.asset?.decimals ?? asset?.decimals ?? 0,
      );
      const rawBalance = asset?.balance ?? asset?.amount ?? '0';
      const balanceReadable = this.formatUnits(String(rawBalance), decimals);

      return {
        ...asset,
        tokenName: symbol ?? null,
        coinName: asset?.kind === 'Native' ? symbol ?? null : null,
        decimals,
        balance: balanceReadable,
      };
    });

    return Array.isArray((res as any)?.assets)
      ? { ...(res as any), assets: mapped }
      : mapped;
  }

  async getWalletBalance(walletId: string, contractOrToken?: string) {
    if (!walletId) {
      throw new BadRequestException('walletId is required');
    }

    const assetsRes = await this.getWalletAssets(walletId);
    const assets = (assetsRes as any)?.assets ?? assetsRes ?? [];

    let found: any;

    if (contractOrToken) {
      const target = String(contractOrToken).toLowerCase();
      const isAddress = /^0x[a-f0-9]{40}$/i.test(target);

      found = (assets as any[]).find((asset) => {
        const contractFields = [
          asset?.contract,
          asset?.metadata?.contract,
          asset?.tokenAddress,
          asset?.asset?.contract,
        ].filter(Boolean) as string[];

        const symbolFields = [
          asset?.metadata?.asset?.symbol,
          asset?.symbol,
        ].filter(Boolean) as string[];

        if (isAddress) {
          return contractFields.some(
            (field) => field.toLowerCase?.() === target,
          );
        }

        return symbolFields.some((symbol) => symbol.toLowerCase?.() === target);
      });

      if (!found) {
        return {
          kind: 'Erc20',
          amount: '0',
          symbol: undefined,
          decimals: undefined,
          contract: contractOrToken,
          raw: null,
        };
      }
    } else {
      found = (assets as any[]).find((asset) => asset?.kind === 'Native');

      if (!found) {
        return {
          kind: 'Native',
          amount: '0',
          symbol: undefined,
          decimals: undefined,
          contract: undefined,
          raw: null,
        };
      }
    }

    let amount = found.amount ?? found?.balance ?? '0';

    if (!contractOrToken && amount === '0') {
      try {
        const historyRes = await this.getWalletHistory(walletId);
        const items = this.extractItems(historyRes);

        const nativeItems = items.filter(
          (item: any) =>
            item?.kind === 'NativeTransfer' && typeof item?.value === 'string',
        );

        if (nativeItems.length) {
          const net = nativeItems.reduce((acc: bigint, item: any) => {
            const value = BigInt(item.value);
            return item?.direction === 'Out' ? acc - value : acc + value;
          }, 0n);

          if (net !== 0n) {
            amount = net.toString();
          }
        }
      } catch {
        // ignore history fallback failure
      }
    }

    if (!contractOrToken && amount === '0') {
      const network = (assetsRes as any)?.network;

      if (network === 'AdiTestnet') {
        const rpcBalance = await this.getAdiTestnetBalance(walletId);
        if (rpcBalance !== null) {
          amount = rpcBalance;
        }
      }
    }

    const Amount = this.formatUnits(amount, Number(found?.decimals ?? 0));

    return {
      kind: found.kind ?? (contractOrToken ? 'Erc20' : 'Native'),
      amount,
      Amount,
      symbol: found?.metadata?.asset?.symbol ?? found?.symbol,
      decimals:
        found?.metadata?.asset?.decimals ??
        found?.metadata?.decimals ??
        found?.decimals,
      contract: found?.contract ?? found?.metadata?.contract ?? contractOrToken,
      raw: found,
    };
  }

  private async getAdiTestnetBalance(walletId: string): Promise<string | null> {
    try {
      const wallet = await this.getWallet(walletId);
      const address = (wallet as any)?.address as string | undefined;

      if (!address) return null;

      // const res = await fetch('https://rpc.ab.testnet.adifoundation.ai', {
      const res = await fetch('https://rpc.spearhead.adifoundation.ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest'],
        }),
      });

      if (!res.ok) return null;

      const json = await res.json();
      const hex = json?.result as string | undefined;

      if (!hex || typeof hex !== 'string') return null;

      return BigInt(hex).toString();
    } catch {
      return null;
    }
  }

  /**
   * Finds a specific ERC20 asset in a wallet by symbol or contract address.
   * Returns normalized asset metadata ready for use in sendAsset payloads.
   * Throws BadRequestException if the asset is not found.
   */
  async findWalletAsset(walletId: string, tokenOrSymbol: string) {
    const assetsRes = await this.getWalletAssets(walletId);
    const assets = (assetsRes as any)?.assets ?? assetsRes ?? [];

    const target = String(tokenOrSymbol).toLowerCase();
    const isAddress = /^0x[a-f0-9]{40}$/i.test(target);

    const found = (assets as any[]).find((asset) => {
      const kind = String(asset?.kind ?? '').toLowerCase();
      const contract =
        asset?.contract ?? asset?.metadata?.contract ?? asset?.tokenAddress;
      const symbol =
        asset?.metadata?.asset?.symbol ??
        asset?.symbol ??
        asset?.tokenName ??
        asset?.coinName;

      if (kind !== 'erc20' || !contract) return false;
      if (isAddress) return String(contract).toLowerCase() === target;
      return String(symbol ?? '').toLowerCase() === target;
    });

    if (!found) {
      throw new BadRequestException(
        `ERC20 asset ${tokenOrSymbol} not found in wallet ${walletId}`,
      );
    }

    return {
      kind: 'Erc20' as const,
      symbol:
        found?.metadata?.asset?.symbol ??
        found?.symbol ??
        found?.tokenName ??
        tokenOrSymbol,
      decimals: Number(
        found?.metadata?.asset?.decimals ??
          found?.metadata?.decimals ??
          found?.decimals ??
          18,
      ),
      contract:
        found?.contract ?? found?.metadata?.contract ?? found?.tokenAddress,
      balance: String(found?.balance ?? '0'),
      raw: found,
    };
  }

  async createSwapQuote(body: CreateSwapQuoteDto) {
    return this.signedPost(
      '/swaps/quotes',
      body as unknown as Record<string, unknown>,
    );
  }

  async createSwap(body: CreateSwapDto) {
    return this.signedPost(
      '/swaps',
      body as unknown as Record<string, unknown>,
    );
  }

  async createTransaction(body: SignedPostDto) {
    const path = body.httpPath ?? '/transactions';
    const result = await this.signedPost(path, body.payload ?? {});

    // If this was a wallet transfer, try to fetch latest status
    try {
      const transferId = (result as any)?.id as string | undefined;
      if (transferId && /^\/wallets\/[^/]+\/transfers$/i.test(path)) {
        const walletId = path.split('/')[2];
        if (walletId) {
          const latest = await this.getWalletTransfer(walletId, transferId);
          return {
            ...result,
            latestStatus: (latest as any)?.status,
            transfer: latest,
          };
        }
      }
    } catch {
      // ignore status lookup failures
    }

    return result;
  }

  async sendAsset(body: SignedPostDto, walletID: string) {
    const payload = { ...(body.payload ?? {}) } as Record<string, unknown>;

    if (!payload.walletId && payload.senderwalletId) {
      payload.walletId = payload.senderwalletId as string;
      delete payload.senderwalletId;
    }

    if (!payload.humanAmount && payload.Amount) {
      payload.humanAmount = payload.Amount as string;
      delete payload.Amount;
    }

    if (!payload.asset) {
      payload.asset = {
        kind: 'Erc20',
        symbol: 'DDSC',
        contract: (this.dfnsConfig as any).ddscTokenContract,
        decimals: (this.dfnsConfig as any).ddscTokenDecimals,
      };
    }

    const walletId = walletID;

    const defaultPath =
      walletId && typeof walletId === 'string'
        ? `/wallets/${walletId}/transfers`
        : '/transfers/send';

    const path = body.httpPath ?? defaultPath;

    if (walletId && path === `/wallets/${walletId}/transfers`) {
      delete payload.walletId;
    }

    if (
      typeof payload.destination === 'string' &&
      !payload.destination.startsWith('{')
    ) {
      payload.destination = { address: payload.destination };
    }

    if (!payload.amount && payload.humanAmount) {
      const decimals = await this.resolveAssetDecimals(
        walletId,
        payload.asset as Record<string, unknown>,
      );

      payload.amount = this.parseUnits(String(payload.humanAmount), decimals);
      delete payload.humanAmount;
    }

    if (payload.asset && payload.destination) {
      const asset = payload.asset as Record<string, unknown>;

      if (!payload.kind && typeof asset.kind === 'string') {
        payload.kind = asset.kind;
      }

      if (!payload.to) {
        const destination = payload.destination as Record<string, unknown>;
        payload.to =
          (destination?.address as string | undefined) ??
          (payload.destination as string | undefined);
      }

      if (!payload.contract && typeof asset.contract === 'string') {
        payload.contract = asset.contract;
      }

      delete payload.asset;
      delete payload.destination;
    }

    if (path.includes('/wallets/') && path.endsWith('/transfers')) {
      if (!payload.kind || !payload.to || !payload.amount) {
        throw new BadRequestException(
          'Transfer requires kind, to, and amount (provide Amount/humanAmount or amount)',
        );
      }
    }

    const result = await this.signedPost(path, payload);
    const responseAmount =
      typeof payload.amount === 'string'
        ? this.formatUnits(
            payload.amount,
            Number(
              (payload.asset as any)?.decimals ??
                (this.dfnsConfig as any).ddscTokenDecimals ??
                0,
            ),
          )
        : undefined;

    // Try to fetch latest transfer status when possible (non-blocking for failures)
    try {
      const transferId = (result as any)?.id as string | undefined;
      if (transferId && walletId) {
        const latest = await this.getWalletTransfer(walletId, transferId);
        const transfer = { ...(latest as any) };
        if (responseAmount !== undefined) {
          transfer.amount = responseAmount;
        }
        return {
          ...result,
          ...(responseAmount !== undefined ? { amount: responseAmount } : {}),
          latestStatus: (latest as any)?.status,
          transfer,
        };
      }
    } catch {
      // ignore status lookup failures; return original result
    }

    if (responseAmount !== undefined) {
      return { ...result, amount: responseAmount };
    }
    return result;
  }

  private formatUnits(value: string, decimals: number): string {
    const safeDecimals =
      Number.isFinite(decimals) && decimals > 0 ? decimals : 0;

    if (safeDecimals === 0) return value;

    const negative = value.startsWith('-');
    const normalized = negative ? value.slice(1) : value;
    const big = BigInt(normalized || '0');
    const base = 10n ** BigInt(safeDecimals);
    const whole = big / base;
    const frac = (big % base).toString().padStart(safeDecimals, '0');
    const trimmed = frac.replace(/0+$/, '');
    const result = trimmed
      ? `${whole.toString()}.${trimmed}`
      : whole.toString();

    return negative ? `-${result}` : result;
  }

  private parseUnits(value: string, decimals: number): string {
    const safeDecimals =
      Number.isFinite(decimals) && decimals >= 0 ? decimals : 0;
    const normalized = value.trim();

    if (!/^\d+(\.\d+)?$/.test(normalized)) {
      throw new BadRequestException('Amount must be a numeric string');
    }

    const [whole, frac = ''] = normalized.split('.');

    if (frac.length > safeDecimals) {
      throw new BadRequestException(
        `Amount has more than ${safeDecimals} decimals`,
      );
    }

    const fracPadded = frac.padEnd(safeDecimals, '0');
    const base = 10n ** BigInt(safeDecimals);
    const big = BigInt(whole || '0') * base + BigInt(fracPadded || '0');

    return big.toString();
  }

  private async resolveAssetDecimals(
    walletId: string | undefined,
    asset?: Record<string, unknown>,
  ): Promise<number> {
    const fromPayload = Number(asset?.decimals);

    if (Number.isFinite(fromPayload) && fromPayload >= 0) {
      return fromPayload;
    }

    if (!walletId) {
      throw new BadRequestException('walletId is required to resolve decimals');
    }

    const assetsRes = await this.getWalletAssets(walletId);
    const assets = (assetsRes as any)?.assets ?? assetsRes ?? [];

    if (asset?.kind === 'Native') {
      const native = (assets as any[]).find(
        (entry) => entry?.kind === 'Native',
      );
      const decimals = Number(
        native?.metadata?.asset?.decimals ?? native?.decimals ?? 0,
      );

      return Number.isFinite(decimals) ? decimals : 0;
    }

    if (asset?.kind === 'Erc20') {
      const contract = (asset?.contract as string | undefined) || '';
      const symbol = (asset?.symbol as string | undefined) || '';
      const targetContract = contract.toLowerCase();
      const targetSymbol = symbol.toLowerCase();

      const match = (assets as any[]).find((entry) => {
        const contractFields = [
          entry?.contract,
          entry?.metadata?.contract,
          entry?.tokenAddress,
          entry?.asset?.contract,
        ].filter(Boolean) as string[];

        const symbolFields = [
          entry?.metadata?.asset?.symbol,
          entry?.symbol,
        ].filter(Boolean) as string[];

        if (targetContract) {
          return contractFields.some(
            (field) => field.toLowerCase?.() === targetContract,
          );
        }

        if (targetSymbol) {
          return symbolFields.some(
            (field) => field.toLowerCase?.() === targetSymbol,
          );
        }

        return false;
      });

      const decimals = Number(
        match?.metadata?.asset?.decimals ?? match?.decimals ?? 0,
      );

      if (Number.isFinite(decimals) && decimals >= 0) return decimals;

      const configContract = String(
        (this.dfnsConfig as any).ddscTokenContract ?? '',
      ).toLowerCase();
      const configDecimals = Number((this.dfnsConfig as any).ddscTokenDecimals);
      const isDdsc =
        (targetContract &&
          configContract &&
          targetContract === configContract) ||
        targetSymbol === 'ddsc';
      if (isDdsc && Number.isFinite(configDecimals)) {
        return configDecimals;
      }

      return 0;
    }

    throw new BadRequestException('Unsupported asset kind for Amount');
  }

  async receiveAsset(body: SignedPostDto) {
    const path = body.httpPath ?? '/transfers/receive';
    return this.signedPost(path, body.payload ?? {});
  }

  async swapAssets(body: SignedPostDto) {
    const path = body.httpPath ?? '/swaps';
    return this.signedPost(path, body.payload ?? {});
  }

  async createCustomAsset(body: SignedPostDto) {
    const path = body.httpPath ?? '/assets';
    return this.signedPost(path, body.payload ?? {});
  }

  async history(body: SignedPostDto) {
    const path = body.httpPath ?? '/history';
    return this.signedPost(path, body.payload ?? {});
  }

  private extractDfnsMessage(raw: string): string {
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.error?.message || parsed?.message || 'Request failed';
    } catch {
      return raw || 'Request failed';
    }
  }
}
