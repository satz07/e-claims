import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DfnsApiClient } from '@dfns/sdk';
import { AsymmetricKeySigner } from '@dfns/sdk-keysigner';
import {
  CreateDelegatedDfnsUserDto,
  CreateDfnsUserDto,
} from './dto/create-dfns-user.dto';

import {
  RegistrationCompleteDto,
  WebAuthnInfoDto,
} from './dto/registration-complete.dto';
import { WalletService } from 'src/wallet/wallet.service';
import {
  extractDfnsEmailFromAuth,
  extractDfnsUserIdFromAuth,
} from 'src/utils/parseDFNSToken/parseDFNSToken';
import { AllConfigType, DfnsConfig } from 'src/config/config.type';
import { ConfigService } from '@nestjs/config';

// base64 -> base64url normalizer (no + / =)
function toBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '==='.slice((b64.length + 3) % 4);
  return Buffer.from(b64 + pad, 'base64')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function normalizeWebAuthn(info: WebAuthnInfoDto): WebAuthnInfoDto {
  return {
    credId: toBase64Url(info.credId),
    clientData: toBase64Url(info.clientData),
    attestationData: toBase64Url(info.attestationData),
  };
}

@Injectable()
export class DNFSUsermanagementService {
  private readonly logger = new Logger(DNFSUsermanagementService.name);
  private readonly dfns: DfnsApiClient;
  private readonly dfnsConfig: DfnsConfig;
  private readonly signer: AsymmetricKeySigner;

  constructor(
    private readonly walletService: WalletService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {
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
  async isDfnsUserRegistered(username: string): Promise<{
    exists: boolean;
    isRegistered: boolean;
    isActive?: boolean;
    userId?: string;
    raw?: any;
  }> {
    const res = await fetch(`${this.dfnsConfig.baseUrl}/auth/users`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.dfnsConfig.authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Check user failed: ${res.status} ${t}`);
    }

    const data = await res.json();

    if (!Array.isArray(data.items)) {
      return { exists: false, isRegistered: false };
    }

    const user = data.items.find(
      (u) => u.username === username || u.email === username,
    );

    if (!user) {
      return { exists: false, isRegistered: false };
    }

    return {
      exists: true,
      isRegistered: user.isRegistered === true,
      isActive: user.isActive === true,
      userId: user.userId,
      raw: user, // optional but useful for logs
    };
  }

  /**
   * Explicit manual user-action flow:
   * 1) Create challenge
   * 2) Sign challenge locally (AsymmetricKeySigner)
   * 3) Create user-action signature → token
   * 4) Call the target endpoint with X-DFNS-USER-ACTION header
   */
  // dfns.service.ts (manual flow that uses fetch for the final POST)
  // dfns.service.ts — manual flow: Challenge → Sign → Token → Final POST
  async createUserManual(input: CreateDfnsUserDto) {
    const username = input.email;

    // 1️⃣ Check existing DFNS user
    const status = await this.isDfnsUserRegistered(username);
    // 2️⃣ Already exists + registered → do NOT create
    if (status.exists && status.isRegistered) {
      throw new ConflictException({
        message: 'DDSC user already exists and is fully registered',
        code: 'DDSC_USER_ALREADY_REGISTERED',
        provider: 'DDSC',
        userId: status.userId,
      });
    }

    // 3️⃣ Exists but NOT registered → do NOT create, ask to complete registration
    if (status.exists && !status.isRegistered) {
      return { ...status.raw };
    }

    const userActionHttpMethod = 'POST';
    const userActionHttpPath = '/auth/users';

    // ✅ Correct payload for Create User (no username/name here)
    const payload = {
      email: input.email,
      kind: 'CustomerEmployee' as const, // required
    };

    // 1) Describe the exact call we intend to make
    const challengeRes = await this.dfns.auth.createUserActionChallenge({
      body: {
        userActionServerKind: 'Api',
        userActionHttpMethod,
        userActionHttpPath,
        userActionPayload: JSON.stringify(payload),
      },
    });

    // 2) Sign the ENTIRE challenge object
    const firstFactor = await this.signer.sign(challengeRes);

    // 3) Exchange for one-time User Action token
    const sigRes = await this.dfns.auth.createUserActionSignature({
      body: {
        challengeIdentifier: challengeRes.challengeIdentifier,
        firstFactor,
      },
    });

    // 4) Do the real POST with the user-action token header
    const res = await fetch(`${this.dfnsConfig.baseUrl}${userActionHttpPath}`, {
      method: userActionHttpMethod,
      headers: {
        Authorization: `Bearer ${this.dfnsConfig.authToken}`,
        'Content-Type': 'application/json',
        'X-DFNS-USERACTION': sigRes.userAction,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let errorBody: any = null;

      try {
        errorBody = await res.json();
      } catch {
        throw new InternalServerErrorException(
          `DDSC error: ${res.status} ${res.statusText}`,
        );
      }

      const dfnsMessage = errorBody?.error?.message ?? 'Unknown DDSC error';

      /**
       * 🎯 Map DFNS errors → HTTP exceptions
       */
      if (res.status === 400 && dfnsMessage === 'user already exists') {
        throw new ConflictException({
          message: 'DDSC user already exists',
          provider: 'DDSC',
          details: errorBody.error,
        });
      }

      if (res.status === 400) {
        throw new BadRequestException({
          message: 'DDSC bad request',
          provider: 'DDSC',
          details: errorBody.error,
        });
      }

      throw new InternalServerErrorException({
        message: 'DDSC create user failed',
        provider: 'DDSC',
        statusCode: res.status,
        details: errorBody.error,
      });
    }

    return res.json();
  }

  async sendRegistrationCode(username: string) {
    const res = await fetch(
      `${this.dfnsConfig.baseUrl}/auth/registration/code`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }, // NO Authorization
        body: JSON.stringify({ orgId: this.dfnsConfig.orgId, username }),
      },
    );
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(
        `sendRegistrationCode failed: ${res.status} ${res.statusText} ${t}`,
      );
    }
    return { success: true };
  }

  async registrationInit(username: string, registrationCode: string) {
    try {
      const body = {
        orgId: this.dfnsConfig.orgId,
        username,
        registrationCode,
      };
      const res = await fetch(
        `${this.dfnsConfig.baseUrl}/auth/registration/init`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        let msg = 'Request failed';
        try {
          const j = raw ? JSON.parse(raw) : null;
          msg = j?.error?.message || j?.message || msg;
        } catch {
          /* ignore */
        }

        if (res.status === 401) {
          // Body will still be { statusCode, message }, but the message is ONLY what you want
          throw new UnauthorizedException(msg);
        }
        throw new HttpException(msg, res.status);
      }

      return await res.json();
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException('Registration init failed', 500);
    }
  }
  async registrationComplete(body: RegistrationCompleteDto) {
    const { temporaryAuthenticationToken, ...payload } = body;

    // Normalize WebAuthn blobs
    payload.firstFactorCredential.credentialInfo = normalizeWebAuthn(
      payload.firstFactorCredential.credentialInfo,
    );
    if (
      payload.secondFactorCredential &&
      'credentialInfo' in payload.secondFactorCredential
    ) {
      (payload.secondFactorCredential as any).credentialInfo =
        normalizeWebAuthn(
          (payload.secondFactorCredential as any).credentialInfo,
        );
    }

    // 1) Finish DFNS registration
    const res = await fetch(`${this.dfnsConfig.baseUrl}/auth/registration`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${temporaryAuthenticationToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      const redacted = t
        .replace(/"attestationData":"[^"]+"/g, '"attestationData":"<redacted>"')
        .replace(/"clientData":"[^"]+"/g, '"clientData":"<redacted>"')
        .replace(
          /"encryptedPrivateKey":"[^"]+"/g,
          '"encryptedPrivateKey":"<redacted>"',
        );
      throw new Error(
        `registrationComplete failed: ${res.status} ${res.statusText} ${redacted}`,
      );
    }

    const data = await res.json(); // usually { credential, user }
    const userId =
      data?.user?.id ||
      data?.user?.userId ||
      data?.userId ||
      data?.credential?.userId;

    // 2) Best-effort: grant default permission/policy to this user
    console.log('DDSC registrationComplete userId:', userId);
    if (userId) {
      try {
        await this.grantDefaultPermissionToUser(userId);
      } catch (e) {
        this.logger.warn(
          `Granting default permission failed for user ${userId}: ${String(e)}`,
        );
        // Do not throw: registration succeeded
      }
    } else {
      this.logger.warn(
        'DDSC registrationComplete: no userId found in response; skipping permission grant',
      );
    }

    return data;
  }

  /**
   * Grant the default permission to a user. Uses dfnsConfig.authToken (org/service account).
   * Prefers dfnsConfig.defaultPermissionId; otherwise resolves by name.
   */
  private async grantDefaultPermissionToUser(userId: string) {
    const orgToken = this.dfnsConfig.authToken;
    const permissionId = this.dfnsConfig.defaultPermissionId;

    const grantRes = await fetch(
      `${this.dfnsConfig.baseUrl}/permissions/${encodeURIComponent(
        permissionId,
      )}/assignments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${orgToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identityId: userId }),
      },
    );

    if (!grantRes.ok) {
      const t = await grantRes.text().catch(() => '');
      throw new Error(
        `Grant permission failed: ${grantRes.status} ${grantRes.statusText} ${t}`,
      );
    }

    this.logger.log(`✅ Granted permission ${permissionId} to user ${userId}`);
  }

  /** Init login for a registered user (username-based). */
  async loginInit(username: string) {
    const status = await this.isDfnsUserRegistered(username);

    if (!status.exists) {
      return {
        success: false,
        message: 'DDSC user does not exist. Please create an account first.',
      };
    }

    if (!status.isRegistered) {
      return {
        success: false,
        message:
          'DDSC user registration is incomplete. Please complete registration first from create account.',
      };
    }
    const res = await fetch(`${this.dfnsConfig.baseUrl}/auth/login/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // NO Authorization
      body: JSON.stringify({
        orgId: this.dfnsConfig.orgId,
        username,
        // loginCode: '123456'  // only if your org uses PasswordProtectedKey credentials
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`loginInit failed: ${res.status} ${res.statusText} ${t}`);
    }
    return res.json(); // WebAuthn assertion options + challengeIdentifier
  }

  async loginComplete(
    challengeIdentifier: string,
    firstFactor: Record<string, unknown>,
  ) {
    try {
      const res = await fetch(`${this.dfnsConfig.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeIdentifier, firstFactor }),
      });

      const raw = await res.text().catch(() => '');

      if (!res.ok) {
        // 👇 This prints exactly the DFNS JSON blob into Nest console
        this.logger.error(
          `loginComplete failed: ${res.status} ${res.statusText} ${raw}`,
        );

        const msg = this.extractDfnsMessage(raw);
        switch (res.status) {
          case 400:
            throw new BadRequestException(msg);
          case 401:
            throw new UnauthorizedException(msg);
          case 403:
            throw new ForbiddenException(msg);
          case 404:
            throw new NotFoundException(msg);
          case 409:
            throw new ConflictException(msg);
          default:
            throw new HttpException(msg, res.status);
        }
      }
      const token = raw ? JSON.parse(raw) : {};
      const userId = extractDfnsUserIdFromAuth(token.token);
      const userWallets = await this.walletService.listWalletsByUser(userId);
      if (userWallets?.items.length === 0) {
        const userEmail = extractDfnsEmailFromAuth(token.token);
        await this.walletService.createOrgWallet({
          network: 'AdiTestnet',
          name: `wallet-${userId}-${userEmail}`,
          userId: Number(userId),
        });
      }

      return token;
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.logger.error(`loginComplete network/unknown error: ${String(e)}`);
      throw new HttpException('Login failed: upstream service error', 502);
    }
  }

  async createDelegatedUser(input: CreateDelegatedDfnsUserDto) {
    const userActionHttpMethod = 'POST';
    const userActionHttpPath = '/auth/registration/delegated';

    const payload = {
      email: input.email,
      kind: 'EndUser' as const,
      externalId: 'us-76p0v-hned9-8879o6am2cp917em',
    };

    const challengeRes = await this.dfns.auth.createUserActionChallenge({
      body: {
        userActionServerKind: 'Api',
        userActionHttpMethod,
        userActionHttpPath,
        userActionPayload: JSON.stringify(payload),
      },
    });

    const firstFactor = await this.signer.sign(challengeRes);

    const sigRes = await this.dfns.auth.createUserActionSignature({
      body: {
        challengeIdentifier: challengeRes.challengeIdentifier,
        firstFactor,
      },
    });

    const res = await fetch(`${this.dfnsConfig.baseUrl}${userActionHttpPath}`, {
      method: userActionHttpMethod,
      headers: {
        Authorization: `Bearer ${this.dfnsConfig.authToken}`,
        'Content-Type': 'application/json',
        'X-DFNS-USERACTION': sigRes.userAction,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let dfnsMessage = 'DDSC create delegated user failed.';
      const statusCode = res.status;

      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error?.message) {
          dfnsMessage = parsed.error.message; // e.g. "User already exists."
        }
      } catch {
        // ignore JSON parse errors, keep defaults
      }

      // 👇 give exactly this message when user already exists
      if (statusCode === 401 && dfnsMessage === 'User already exists.') {
        throw new ConflictException('User already exists.');
      }

      // Otherwise, surface DFNS error/status as-is
      if (statusCode >= 400 && statusCode < 600) {
        throw new HttpException(dfnsMessage, statusCode);
      }

      throw new InternalServerErrorException(dfnsMessage);
    }

    return res.json();
  }
  async delegatedLogin(username: string) {
    const userActionHttpMethod = 'POST';
    const userActionHttpPath = '/auth/login/delegated';

    const payload = { username };

    const challengeRes = await this.dfns.auth.createUserActionChallenge({
      body: {
        userActionServerKind: 'Api',
        userActionHttpMethod,
        userActionHttpPath,
        userActionPayload: JSON.stringify(payload),
      },
    });

    const firstFactor = await this.signer.sign(challengeRes);

    const sigRes = await this.dfns.auth.createUserActionSignature({
      body: {
        challengeIdentifier: challengeRes.challengeIdentifier,
        firstFactor,
      },
    });

    const res = await fetch(`${this.dfnsConfig.baseUrl}${userActionHttpPath}`, {
      method: userActionHttpMethod,
      headers: {
        Authorization: `Bearer ${this.dfnsConfig.authToken}`,
        'Content-Type': 'application/json',
        'X-DFNS-USERACTION': sigRes.userAction,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `DDSC delegated login failed: ${res.status} ${res.statusText} ${errText}`,
      );
    }

    return res.json(); // { token: "<dfns-user-token>" }
  }

  /** Complete login with WebAuthn assertion → returns DFNS user token. */
  private extractDfnsMessage(raw: string): string {
    try {
      const j = raw ? JSON.parse(raw) : null;
      return j?.error?.message || j?.message || 'Request failed';
    } catch {
      return raw || 'Request failed';
    }
  }
  /** Delete a DFNS user (Org scope). */
  async deleteDfnsUser(userId: string) {
    if (!userId) throw new BadRequestException('userId is required');
    const res = await fetch(
      `${this.dfnsConfig.baseUrl}/org/users/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.dfnsConfig.authToken}` },
      },
    );
    const raw = await res.text().catch(() => '');
    if (!res.ok) {
      const msg = this.extractDfnsMessage(raw);
      this.logger.error(
        `DDSC DELETE /org/users/${userId} failed: ${res.status} ${msg}`,
      );
      throw new HttpException({ message: msg }, res.status);
    }
    // Some DDSC DELETE endpoints may return empty body
    return raw ? JSON.parse(raw) : { ok: true };
  }

  /** Get a DFNS user by id (Org scope). */
  async getDfnsUser(userId: string) {
    if (!userId) throw new BadRequestException('userId is required');
    const res = await fetch(
      `${this.dfnsConfig.baseUrl}/org/users/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.dfnsConfig.authToken}` },
      },
    );
    const raw = await res.text().catch(() => '');
    if (!res.ok) {
      const msg = this.extractDfnsMessage(raw);
      this.logger.error(
        `DDSC GET /org/users/${userId} failed: ${res.status} ${msg}`,
      );
      throw new HttpException({ message: msg }, res.status);
    }
    return raw ? JSON.parse(raw) : {};
  }

  /** List DFNS users; optionally filter by externalId or email (best-effort client-side filter). */
  async listDfnsUsers({ email }) {
    const params = new URLSearchParams();
    // params.append('limit', '1'); // optional

    const res = await fetch(
      `${this.dfnsConfig.baseUrl}/auth/users?${params.toString()}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.dfnsConfig.authToken}` },
      },
    );

    const raw = await res.text().catch(() => '');
    console.log('listDfnsUsers raw response:', raw);

    if (!res.ok) {
      const msg = this.extractDfnsMessage(raw);
      throw new HttpException({ message: msg }, res.status);
    }

    const data = raw ? JSON.parse(raw) : {};
    const items = Array.isArray(data?.items) ? data.items : [];

    // Find the user that matches the email
    const user = items.find(
      (u: any) => u?.username === email || u?.user?.email === email,
    );

    return {
      isCreated: !!user, // true if user exists
      isRegistered: user?.isRegistered || false, // true if user is registered
    };
  }
}
