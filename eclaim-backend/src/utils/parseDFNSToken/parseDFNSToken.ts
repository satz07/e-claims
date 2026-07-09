import { JwtService } from '@nestjs/jwt';

export type DfnsTokenInfo = {
  userId?: string;
  orgId?: string;
  tokenKind?: string;
  payload?: Record<string, unknown> | null;
};

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '==='.slice((b64.length + 3) % 4);
  return Buffer.from(b64 + pad, 'base64').toString('utf8');
}

/**
 * Parse a DFNS JWT and extract common fields like end-user id (us-...), org id, and token kind.
 * Returns null if token is missing/invalid.
 */
export function parseDFNSToken(token?: string): DfnsTokenInfo | null {
  if (!token) return null;
  const raw = token.trim().toLowerCase().startsWith('bearer ')
    ? token.trim().slice(7)
    : token.trim();
  const parts = raw.split('.');
  if (parts.length < 2) return null;
  try {
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;

    const appMeta = (payload['https://custom/app_metadata'] ||
      payload['app_metadata']) as Record<string, unknown> | undefined;
    const candidates: unknown[] = [
      payload['userId'],
      payload['sub'],
      appMeta?.['userId'],
      (payload['user'] as any)?.id,
    ];

    // Recognize both Org User (us-...) and End User ids (common prefixes like eu-/en-)
    const asString = candidates.filter(
      (v) => typeof v === 'string',
    ) as string[];
    const endUserPrefixes = ['eu-', 'en-']; // extend if your tenant uses different end-user prefixes
    const orgUserPrefix = 'us-';

    // Prefer an end-user id if present; otherwise fall back to org user id
    const endUserId = asString.find((s) =>
      endUserPrefixes.some((p) => s.startsWith(p)),
    );
    const orgUserId = asString.find((s) => s.startsWith(orgUserPrefix));
    const userId: string | undefined = endUserId ?? orgUserId ?? undefined;

    const orgId =
      (appMeta?.['orgId'] as string) ||
      (payload['orgId'] as string) ||
      undefined;
    const tokenKind = (appMeta?.['tokenKind'] as string) || undefined;

    return { userId, orgId, tokenKind, payload };
  } catch {
    return null;
  }
}

/**
 * Extract DFNS end-user id (us-...) from an Authorization header or raw token string.
 * Accepts either 'Bearer <jwt>' or a raw JWT. Returns null if not found.
 */
export function extractDfnsUserIdFromAuth(
  authorizationOrToken?: string,
): string | null {
  if (!authorizationOrToken) return null;
  const raw = authorizationOrToken.trim().toLowerCase().startsWith('bearer ')
    ? authorizationOrToken.trim().slice(7)
    : authorizationOrToken.trim();
  const info = parseDFNSToken(raw);
  return info?.userId ?? null;
}

export function extractDfnsEmailFromAuth(
  authorizationOrToken?: string,
): string | null {
  if (!authorizationOrToken) return null;

  // Remove "Bearer " prefix if present
  const raw = authorizationOrToken.trim().toLowerCase().startsWith('bearer ')
    ? authorizationOrToken.trim().slice(7)
    : authorizationOrToken.trim();

  // Parse the token
  const info = parseDFNSToken(raw);

  // Extract email from payload
  const email = info?.payload?.['https://custom/username'];
  return typeof email === 'string' ? email : null;
}
