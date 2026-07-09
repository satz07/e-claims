import { Injectable, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StatusCodes } from 'http-status-codes';
import type { Algorithm } from 'jsonwebtoken';

import { CustomRequest } from '../types/Request';
import { CommonErrorResponse } from '../common/common-response';
import { WalletService } from 'src/wallet/wallet.service';
import { RedisService } from 'src/redis/redis.service';

type AppJwtPayload = {
  sub: number;
  email: string;
  role: 'ADMIN' | 'USER' | string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
  jti?: string;
};

type WalletCacheValue =
  | {
      walletId: string;
      walletAddress: string;
    }
  | 'NO_WALLET';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly walletService: WalletService,
    private readonly redisService: RedisService,
  ) {}

  async use(req: CustomRequest, res: Response, next: NextFunction) {
    try {
      const token = this.extractBearerToken(req);

      const alg = (this.configService.get<string>('auth.alg', {
        infer: true,
      }) ?? 'RS256') as Algorithm;

      const issuer = this.configService.get<string>('auth.issuer', {
        infer: true,
      });

      const audience = this.configService.get<string>('auth.audience', {
        infer: true,
      });

      const payload = await this.jwtService.verifyAsync<AppJwtPayload>(token, {
        algorithms: [alg],
        issuer,
        audience,
      });
      console.log('Decoded JWT payload:', payload);

      if (!payload?.role || payload.sub === undefined) {
        throw new CommonErrorResponse(
          StatusCodes.UNAUTHORIZED,
          null,
          'Invalid token payload',
        );
      }
      const role = String(payload.role).toUpperCase();

      if (role !== 'ADMIN' && role !== 'USER') {
        throw new CommonErrorResponse(
          StatusCodes.UNAUTHORIZED,
          null,
          'Invalid role',
        );
      }

      const wallet = await this.getCachedWallet(payload.sub);

      req.user = {
        email: payload.email ?? null,
        role,
        userId: payload.sub,
        type: role,
        wallet,
      };
      console.log(req.user, '========================');
      req.token = token;
      return next();
    } catch (err: any) {
      if (err instanceof CommonErrorResponse) throw err;
      console.log('JWT verification failed:', err);
      const msg =
        err?.name === 'TokenExpiredError'
          ? 'Token expired'
          : 'Invalid or expired token';

      throw new CommonErrorResponse(StatusCodes.UNAUTHORIZED, null, msg);
    }
  }

  private async getCachedWallet(
    userId: number,
  ): Promise<{ walletId: string; walletAddress: string | null } | null> {
    const cacheKey = `user_wallet:${userId}`;

    try {
      const cached = await this.redisService.get<WalletCacheValue>(cacheKey);

      if (cached) {
        if (cached === 'NO_WALLET') {
          return null;
        }

        return cached;
      }

      const walletData = await this.walletService.getWalletByUserIdDB(userId);

      if (walletData) {
        const wallet = {
          walletId: walletData.walletId,
          walletAddress: walletData.address ?? null,
        };

        await this.redisService.insert(cacheKey, wallet);
        return wallet;
      }

      await this.redisService.insert(cacheKey, 'NO_WALLET');
      return null;
    } catch (error: any) {
      console.error('Wallet cache/db failed:', error?.message);
      return null;
    }
  }

  private extractBearerToken(req: CustomRequest): string {
    const authHeader = req.headers['authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new CommonErrorResponse(
        StatusCodes.UNAUTHORIZED,
        null,
        'No Authorization header found',
      );
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match?.[1]) {
      throw new CommonErrorResponse(
        StatusCodes.UNAUTHORIZED,
        null,
        'No valid Authorization header found',
      );
    }

    return match[1].trim();
  }
}
