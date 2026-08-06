import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';
import { SKIP_ECLAIM_API_KEY } from './skip-eclaim-api-key.decorator';

function parseKeys(raw: string | undefined): string[] {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Protects public e-claim / registry / integration routes with a shared API key.
 *
 * Accepts either:
 *   X-API-Key: <key>
 *   Authorization: Bearer <key>
 *
 * Env: ECLAIM_API_KEYS=key1,key2  (comma-separated allowed keys)
 * If unset/empty, requests are allowed (dev convenience) with a one-time warning.
 */
@Injectable()
export class EclaimApiKeyGuard implements CanActivate {
  private warnedOpen = false;

  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ECLAIM_API_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skip) return true;

    const allowed = parseKeys(process.env.ECLAIM_API_KEYS);
    if (allowed.length === 0) {
      if (!this.warnedOpen) {
        this.warnedOpen = true;
        console.warn(
          '[EclaimApiKeyGuard] ECLAIM_API_KEYS is not set — public e-claim APIs are open. Set keys before production use.',
        );
      }
      return true;
    }

    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const headerKey = req.headers['x-api-key'];
    const auth = req.headers['authorization'];

    let provided = '';
    if (typeof headerKey === 'string' && headerKey.trim()) {
      provided = headerKey.trim();
    } else if (typeof auth === 'string' && /^Bearer\s+/i.test(auth)) {
      provided = auth.replace(/^Bearer\s+/i, '').trim();
    }

    if (!provided || !allowed.some((k) => safeEqual(provided, k))) {
      throw new UnauthorizedException(
        'Missing or invalid API key. Pass X-API-Key or Authorization: Bearer <key>.',
      );
    }
    return true;
  }
}
