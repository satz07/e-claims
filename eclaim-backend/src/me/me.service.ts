// src/modules/bank-info/bank-info.service.ts
import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from 'src/database/entities/users.entity';
import { UserKyc } from 'src/database/entities/user-kyc.entity';
import { UserBank } from 'src/database/entities/user-bank.entity';
import { Wallet } from 'src/database/entities/wallet.entity';
import { WalletService } from 'src/wallet/wallet.service';
import { CustomRequest } from 'src/types/Request';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MeService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(UserKyc)
    private readonly kycRepo: Repository<UserKyc>,

    @InjectRepository(UserBank)
    private readonly bankRepo: Repository<UserBank>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    private readonly walletService: WalletService,
    private readonly configService: ConfigService,
  ) {}

  private maskIban(iban: string) {
    if (!iban) return '';
    return `****${iban.slice(-4)}`;
  }

  async getMeInfo(req: CustomRequest) {
    const { email } = req.user;
    if (!email) throw new UnauthorizedException('Token missing email');

    const user = await this.userRepo.findOne({
      where: { email },
      relations: { twoFactor: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const kyc = await this.kycRepo.findOne({
      where: { email },
      select: ['id', 'reviewStatus', 'accountType'],
    });

    let banks: UserBank[] = [];
    if (kyc) {
      banks = await this.bankRepo.find({
        where: { kycId: kyc.id },
        order: { createdAt: 'DESC' },
      });
    }

    let walletData: any = { items: [] };
    try {
      walletData = await this.walletService.getWalletAssets(
        req.user.wallet.walletId,
      );
    } catch (error) {
      console.error('Wallet service failed:', error?.message);
    }

    const configuredNetwork = this.configService.get<string>('dfns.network');

    let filteredWallets = (walletData?.assets || []).filter(
      (wallet: any) => wallet?.kind === 'Erc20',
    );
    const erc20 = filteredWallets[0];

    console.log('Filtered wallets from DFNS:', filteredWallets);

    const result = {
      balance: erc20 ? Number(erc20.balance) : 0,
      symbol: erc20?.symbol || 'DDSC',
      decimals: erc20?.decimals || 6,
    };

    // Fallback: if DFNS returned nothing, use the local DB wallet record
    // if (filteredWallets.length === 0) {
    const dbWallet = await this.walletRepo.findOne({
      where: { userId: user.id },
    });

    if (dbWallet) {
      filteredWallets = [
        {
          id: dbWallet.walletId,
          address: dbWallet.address,
          network: configuredNetwork,
          status: dbWallet.status,
          walletDetail: result,
        },
      ];
    }
    // }

    // Enhance wallets with real-time balance and missing details
    // const walletsWithBalance = await Promise.all(
    //   filteredWallets.map(async (w: any) => {
    //     try {
    //       const walletId = w.id || w.walletId;
    //       const [balance, detail] = await Promise.all([
    //         this.walletService.getWalletBalance(walletId),
    //         w.walletDetail
    //           ? Promise.resolve(w.walletDetail)
    //           : this.walletService.getWalletAssets(walletId),
    //       ]);
    //       return {
    //         ...w,
    //         balance,
    //         walletDetail: detail,
    //       };
    //     } catch (error) {
    //       console.error(
    //         `Failed to fetch balance/detail for wallet ${w.id || w.walletId}:`,
    //         error?.message,
    //       );
    //       return {
    //         ...w,
    //         balance: w.balance ?? null,
    //         walletDetail: w.walletDetail ?? null,
    //       };
    //     }
    //   }),
    // );

    const networkInfo = this.getNetworkInfo(configuredNetwork);

    return {
      userId: user.id,
      email: user.email,
      accountType: kyc?.accountType ?? null,
      emailVerified: user.isEmailVerified,
      wallet: {
        item: filteredWallets,
      },
      network: networkInfo,
      security: {
        twoFactorEnabled: !!user.twoFactor?.enabled,
      },

      ...(kyc && {
        kyc: {
          status: kyc.reviewStatus,
          accountType: kyc.accountType,
        },
      }),

      banks: banks.map((b) => ({
        accountName: b.accountName,
        iban: this.maskIban(b.iban),
        status: b.status,
        ...(b.reason && { reason: b.reason }),
      })),
    };
  }

  private getNetworkInfo(network?: string) {
    if (network === 'AdiTestnet') {
      return {
        key: 'AdiTestnet',
        name: 'Adi Testnet',
        symbol: 'testADI',
      };
    }

    if (network === 'EthereumSepolia') {
      return {
        key: 'EthereumSepolia',
        name: 'Ethereum Sepolia',
        symbol: 'ETH',
      };
    }

    return {
      key: network || 'UNKNOWN',
      name: network || 'Unknown Network',
      symbol: 'N/A',
    };
  }
}
