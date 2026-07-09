import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import axios from 'axios';
import {
  CryptoQuoteRequestDto,
  CryptoQuoteResponseDto,
} from './dto/crypto-quote.dto';
import { WalletService } from 'src/wallet/wallet.service';

@Injectable()
export class CryptoPriceService {
  private readonly apiKey = '8ecba901d93643b88e4fa0efec4595aa';
  private readonly baseUrl = 'https://pro-api.coinmarketcap.com/v1';
  private readonly masterWalletId = 'wa-01jnh-n1pq5-e0nb8k0qvah8jq7k';
  private readonly settlementSymbol = 'DDSC';

  constructor(private readonly walletService: WalletService) {}

  async validateTrade(
    dto: CryptoQuoteRequestDto,
    walletId: string,
  ): Promise<CryptoQuoteResponseDto & Record<string, any>> {
    const symbol = dto.assetSymbol.trim().toUpperCase();
    const side = dto.side.trim().toUpperCase();
    const amount = Number(dto.amount);

    if (!walletId) {
      throw new BadRequestException('walletId is required');
    }

    if (!['BUY', 'SELL'].includes(side)) {
      throw new BadRequestException('side must be BUY or SELL');
    }

    if (!dto.amount || Number.isNaN(amount) || amount <= 0) {
      throw new BadRequestException(
        'amount must be a valid number greater than 0',
      );
    }

    const liveData = await this.getLiveQuote(symbol);

    const userWallet = await this.walletService.getWallet(walletId);
    const masterWallet = await this.walletService.getWallet(
      this.masterWalletId,
    );

    const userAddress = userWallet?.address;
    const masterAddress = masterWallet?.address;

    if (!userAddress) {
      throw new BadRequestException('User wallet address not found');
    }

    if (!masterAddress) {
      throw new BadRequestException('Master wallet address not found');
    }

    const userDdscAsset = await this.findWalletAsset(
      walletId,
      this.settlementSymbol,
    );
    const masterDdscAsset = await this.findWalletAsset(
      this.masterWalletId,
      this.settlementSymbol,
    );

    const userAvailable = Number(userDdscAsset.balance ?? 0);
    const masterAvailable = Number(masterDdscAsset.balance ?? 0);

    let settlement: any = null;

    if (side === 'BUY') {
      if (!Number.isFinite(userAvailable) || userAvailable < amount) {
        throw new BadRequestException(`User does not have enough BOL balance`);
      }

      if (!Number.isFinite(masterAvailable) || masterAvailable < amount) {
        throw new BadRequestException(
          `Master wallet does not have enough BOL balance`,
        );
      }

      const userTransfer = await this.walletService.sendAsset(
        {
          payload: {
            asset: {
              kind: 'Erc20',
              symbol: userDdscAsset.symbol,
              decimals: Number(userDdscAsset.decimals ?? 18),
              contract: userDdscAsset.contract,
            },
            destination: masterAddress,
            humanAmount: String(amount),
          },
        } as any,
        walletId,
      );

      const masterTransfer = await this.walletService.sendAsset(
        {
          payload: {
            asset: {
              kind: 'Erc20',
              symbol: masterDdscAsset.symbol,
              decimals: Number(masterDdscAsset.decimals ?? 18),
              contract: masterDdscAsset.contract,
            },
            destination: userAddress,
            humanAmount: String(amount),
          },
        } as any,
        this.masterWalletId,
      );

      settlement = {
        flow: 'BUY',
        marketReferenceSymbol: symbol,
        userPaysToMaster: {
          from: walletId,
          to: this.masterWalletId,
          symbol: 'BOL', //this.settlementSymbol,
          amount,
          transfer: userTransfer,
        },
        masterSendsToUser: {
          from: this.masterWalletId,
          to: walletId,
          symbol: 'BOL', //this.settlementSymbol,
          amount,
          transfer: masterTransfer,
        },
      };
    } else {
      if (!Number.isFinite(userAvailable) || userAvailable < amount) {
        throw new BadRequestException(`User does not have enough BOL balance`);
      }

      if (!Number.isFinite(masterAvailable) || masterAvailable < amount) {
        throw new BadRequestException(
          `Master wallet does not have enough BOL balance`,
        );
      }

      const userTransfer = await this.walletService.sendAsset(
        {
          payload: {
            asset: {
              kind: 'Erc20',
              symbol: userDdscAsset.symbol,
              decimals: Number(userDdscAsset.decimals ?? 18),
              contract: userDdscAsset.contract,
            },
            destination: masterAddress,
            humanAmount: String(amount),
          },
        } as any,
        walletId,
      );

      const masterTransfer = await this.walletService.sendAsset(
        {
          payload: {
            asset: {
              kind: 'Erc20',
              symbol: masterDdscAsset.symbol,
              decimals: Number(masterDdscAsset.decimals ?? 18),
              contract: masterDdscAsset.contract,
            },
            destination: userAddress,
            humanAmount: String(amount),
          },
        } as any,
        this.masterWalletId,
      );

      settlement = {
        flow: 'SELL',
        marketReferenceSymbol: symbol,
        userSendsToMaster: {
          from: walletId,
          to: this.masterWalletId,
          symbol: 'BOL', //this.settlementSymbol,
          amount,
          transfer: userTransfer,
        },
        masterPaysToUser: {
          from: this.masterWalletId,
          to: walletId,
          symbol: 'BOL', //this.settlementSymbol,
          amount,
          transfer: masterTransfer,
        },
      };
    }

    return {
      side,
      symbol,
      name: liveData.name,
      amount,
      liveUnitPriceUsd: liveData.priceUsd,
      quoteAmountUsd: Number((amount * liveData.priceUsd).toFixed(8)),
      settlementSymbol: 'BOL', //this.settlementSymbol,
      settlementAmount: amount,
      status: 'SUCCESS',
      message: `${side} validated and DDSC settlement completed successfully`,
      marketTimestamp: liveData.lastUpdated,
      settlement,
    };
  }

  async getLiveQuote(symbol: string) {
    try {
      const normalizedSymbol = symbol.trim().toUpperCase();

      const response = await axios.get(
        `${this.baseUrl}/cryptocurrency/quotes/latest`,
        {
          headers: {
            'X-CMC_PRO_API_KEY': this.apiKey,
            Accept: 'application/json',
          },
          params: {
            symbol: normalizedSymbol,
            convert: 'USD',
          },
        },
      );

      const coin = response.data?.data?.[normalizedSymbol];

      if (!coin || !coin.quote?.USD) {
        throw new BadRequestException(
          `No market data found for symbol: ${normalizedSymbol}`,
        );
      }

      const priceUsd = Number(coin.quote.USD.price.toFixed(8));

      return {
        symbol: normalizedSymbol,
        name: coin.name,
        priceUsd,
        priceUsdt: priceUsd,
        lastUpdated: coin.quote.USD.last_updated,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const message =
        error?.response?.data?.status?.error_message ||
        error?.message ||
        'Failed to fetch market data from CoinMarketCap';

      throw new InternalServerErrorException(message);
    }
  }

  private async findWalletAsset(walletId: string, tokenOrSymbol: string) {
    // Delegates to WalletService — single source of truth for asset resolution
    return this.walletService.findWalletAsset(walletId, tokenOrSymbol);
  }
}
