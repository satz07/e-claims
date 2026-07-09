// src/modules/user-management/user-management.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, LessThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';

import base64url from 'base64url';

import { User } from 'src/database/entities/users.entity';
import { UserPasskey } from 'src/database/entities/user-passkey.entity';
import { MailService } from 'src/mail/mail.service';
import { AllConfigType } from 'src/config/config.type';
import {
  KycReviewStatus,
  UserKyc,
} from 'src/database/entities/user-kyc.entity';
import { WalletService } from 'src/wallet/wallet.service';
import { KYCService } from 'src/user-kyc/user-kyc.service';
import { TwoFactorService } from './two-factor.service';
import { randomUUID } from 'crypto';
import { CustomRequest } from 'src/types/Request';
import {
  KeycloakProvisionStatus,
  UserKeycloak,
} from 'src/database/entities/userkeycloak.entity';
import { KeycloakService } from 'src/keycloak/keycloak.service';
import { Wallet, WalletStatus } from 'src/database/entities/wallet.entity';

type EmailTokenPayload = { sub: number; type: 'email-verify' };
type ResetEmailTokenPayload = { sub: number; type: 'reset-email-verify' };
type TempTokenPayload = {
  sub: number;
  type: 'register' | 'login' | 'reset' | '2fa-toggle' | '2fa-login';
};
@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);
  private isKeycloakSyncRunning = false;
  private readonly maxRetries = 5;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserPasskey)
    private readonly passkeyRepo: Repository<UserPasskey>,
    @InjectRepository(UserKyc)
    private readonly userKycRepo: Repository<UserKyc>,
    @InjectRepository(UserKeycloak)
    private readonly userKeycloakRepo: Repository<UserKeycloak>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    private readonly twoFactorService: TwoFactorService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly walletService: WalletService,
    private readonly kycService: KYCService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly keycloakService: KeycloakService,
  ) {}

  /**
   * ✅ WebAuthn config supporting:
   * - multiple origins (web + android facet + ios)
   * - multiple rpIDs (prod + localhost)
   *
   * NOTE:
   * - generate*Options requires a single rpID -> we use first rpID.
   * - verify*Response requires a single expectedRPID -> we dynamically choose based on client origin.
   */
  private get webAuthnCfg() {
    const cfg = this.configService.get('webauthn', { infer: true });
    if (!cfg) throw new Error('Missing webauthn config');

    const rpName = cfg.rpName;
    const origins = (cfg.allowedOrigin ?? []).filter(Boolean);
    const rpIDs = (cfg.allowedRpID ?? []).filter(Boolean);

    if (!rpName) throw new Error('Missing WEBAUTHN_RP_NAME');
    if (!origins.length) throw new Error('Missing WEBAUTHN_ALLOWED_ORIGIN');
    if (!rpIDs.length) throw new Error('Missing WEBAUTHN_ALLOWED_RPID');

    // generate*Options expects a single rpID → use first one.
    const rpID = rpIDs[0];

    return { rpName, origins, rpIDs, rpID };
  }

  // ---------------- WEB AUTHN HELPERS ----------------

  /** Extract origin from clientDataJSON in WebAuthn credential/assertion. */
  private parseClientOrigin(credential: any): string | null {
    try {
      const b64 = credential?.response?.clientDataJSON;
      if (!b64) return null;

      // WebAuthn clientDataJSON is base64url-encoded usually, but Buffer can decode base64 too.
      // If you ever face decode issues, swap to base64url.toBuffer(b64).
      const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      return typeof json?.origin === 'string' ? json.origin : null;
    } catch {
      return null;
    }
  }

  /**
   * Choose the expected RP ID based on client origin hostname:
   * - If rpID equals hostname OR hostname endsWith('.' + rpID) -> match.
   * - Else fallback to first configured rpID.
   */
  private chooseExpectedRpId(clientOrigin: string | null, rpIDs: string[]) {
    if (clientOrigin) {
      try {
        const host = new URL(clientOrigin).hostname;

        // Match exact hostname or parent domain rule
        const match = rpIDs.find((r) => r === host || host.endsWith(`.${r}`));
        if (match) return match;
      } catch {
        // ignore
      }
    }

    return rpIDs[0];
  }

  private signAccessToken(user: User) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: randomUUID(),
    });
  }

  private signEmailVerificationToken(userId: number) {
    return this.jwtService.sign(
      { sub: userId, type: 'email-verify' } satisfies EmailTokenPayload,
      { expiresIn: '1m' },
    );
  }

  private signResetEmailVerificationToken(userId: number) {
    return this.jwtService.sign(
      {
        sub: userId,
        type: 'reset-email-verify',
      } satisfies ResetEmailTokenPayload,
      { expiresIn: '5m' },
    );
  }

  private signTempToken(userId: number, type: TempTokenPayload['type']) {
    return this.jwtService.sign(
      { sub: userId, type } satisfies TempTokenPayload,
      { expiresIn: '5m' },
    );
  }
  // ---------------- GET ALL USER FOR KEYCLOAK PROCESSING ----------------
  async processPendingKeycloakUsers(batchSize = 10) {
    if (this.isKeycloakSyncRunning) {
      this.logger.warn('Keycloak sync already running, skipping this cycle');
      return {
        processed: 0,
        success: 0,
        failed: 0,
      };
    }

    this.isKeycloakSyncRunning = true;

    try {
      await this.ensureMissingKeycloakRows();

      const pendingUsers = await this.userKeycloakRepo.find({
        where: [
          {
            provisionStatus: KeycloakProvisionStatus.PENDING,
          },
          {
            provisionStatus: KeycloakProvisionStatus.FAILED,
            retryCount: LessThan(this.maxRetries),
          },
        ],
        relations: ['user'],
        order: {
          createdAt: 'ASC',
        },
        take: batchSize,
      });

      if (!pendingUsers.length) {
        this.logger.log('No users pending for Keycloak onboarding');
        return {
          processed: 0,
          success: 0,
          failed: 0,
        };
      }

      const token = await this.keycloakService.getAdminToken();

      let success = 0;
      let failed = 0;

      for (const item of pendingUsers) {
        try {
          await this.userKeycloakRepo.update(item.id, {
            provisionStatus: KeycloakProvisionStatus.PROCESSING,
            errorMessage: null,
          });

          const email = item.user?.email?.trim()?.toLowerCase();

          if (!email) {
            throw new Error(`Email missing for userId=${item.userId}`);
          }

          const createdUser = await this.keycloakService.createUser(
            token,
            email,
          );

          await this.userKeycloakRepo.update(item.id, {
            keycloakUserId: createdUser.userId,
            provisionStatus: KeycloakProvisionStatus.COMPLETED,
            errorMessage: null,
            provisionedAt: new Date(),
          });

          success++;
          this.logger.log(
            `Keycloak onboarding success for userId=${item.userId}, keycloakUserId=${createdUser.userId}`,
          );
        } catch (error: any) {
          const freshRecord = await this.userKeycloakRepo.findOne({
            where: { id: item.id },
          });

          const retryCount = (freshRecord?.retryCount ?? 0) + 1;

          const message =
            error?.response?.data?.errorMessage ||
            error?.response?.data?.error ||
            error?.message ||
            'Unknown Keycloak onboarding error';

          await this.userKeycloakRepo.update(item.id, {
            provisionStatus: KeycloakProvisionStatus.FAILED,
            errorMessage: String(message),
            retryCount,
          });

          failed++;
          this.logger.error(
            `Keycloak onboarding failed for userId=${item.userId}. retry=${retryCount}. error=${message}`,
          );
        }
      }

      return {
        processed: pendingUsers.length,
        success,
        failed,
      };
    } finally {
      this.isKeycloakSyncRunning = false;
    }
  }

  async ensureMissingKeycloakRows() {
    const users = await this.userRepo.find({
      relations: ['keycloak'],
    });

    const missingUsers = users.filter((user) => !user.keycloak);

    if (!missingUsers.length) {
      return 0;
    }

    const rows = missingUsers.map((user) =>
      this.userKeycloakRepo.create({
        userId: user.id,
        provisionStatus: KeycloakProvisionStatus.PENDING,
        retryCount: 0,
        errorMessage: null,
        keycloakUserId: null,
        provisionedAt: null,
      }),
    );

    await this.userKeycloakRepo.save(rows);

    this.logger.log(`Created ${rows.length} missing user_keycloak rows`);

    return rows.length;
  }

  // ---------------- CREATE USER ----------------
  async createUser(email: string) {
    const normalized = email.toLowerCase().trim();
    if (!normalized.includes('@') || normalized.length > 255) {
      throw new BadRequestException('Invalid email');
    }

    const existing = await this.userRepo.findOne({
      where: { email: normalized },
    });
    if (existing) {
      return { success: true, userId: existing.id, alreadyExists: true };
    }

    const user = this.userRepo.create({ email: normalized });
    const saved = await this.userRepo.save(user);
    await this.twoFactorService.ensureRow(saved.id);
    return { success: true, userId: saved.id, alreadyExists: false };
  }

  // ---------------- REGISTER: SEND EMAIL CODE ----------------
  async sendEmailCode(email: string) {
    const normalized = email.toLowerCase().trim();

    // ✅ must exist in KYC table first
    const kycUser = await this.userKycRepo.findOne({
      where: { email: normalized },
    });
    if (!kycUser) {
      throw new NotFoundException('Please start from signup process');
    }

    // ✅ ensure user exists (and load passkeys to know registration status)
    let user = await this.userRepo.findOne({
      where: { email: normalized },
      relations: ['passkeys'],
    });

    if (!user) {
      user = this.userRepo.create({ email: normalized });
      user = await this.userRepo.save(user);
      user.passkeys = [];
    }

    // ✅ Already completed registration (best check = has passkey)
    if (user.passkeys?.length) {
      return {
        success: true,
        alreadyRegistered: true,
        message: 'You are already registered. Please login using your passkey.',
      };
    }

    // ✅ throttle
    if (user.emailVerifyCodeSentAt) {
      const diffSec =
        (Date.now() - user.emailVerifyCodeSentAt.getTime()) / 1000;
      if (diffSec < 30) {
        throw new BadRequestException(
          `Please wait ${Math.ceil(
            30 - diffSec,
          )} seconds before requesting a new code`,
        );
      }
    }

    // ✅ generate and store code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerifyCode = code;
    user.emailVerifyCodeSentAt = new Date();
    await this.userRepo.save(user);
    await this.twoFactorService.ensureRow(user.id);

    await this.mailService.sendAuthCodeEmail({
      to: normalized,
      data: {
        username: normalized,
        verificationCode: code,
        expiryMinutes: 1,
        type: 'verify',
      },
    });

    return {
      success: true,
      alreadyRegistered: false,
      message: 'Verification code sent. Please check your email.',
    };
  }

  // ---------------- REGISTER: VERIFY EMAIL CODE ----------------
  async verifyEmailCode(email: string, code: string) {
    const normalized = email.toLowerCase().trim();
    const user = await this.userRepo.findOne({ where: { email: normalized } });

    if (!user) throw new NotFoundException('Please start from create process');
    if (user.isEmailVerified)
      throw new BadRequestException('Email already verified');

    if (!user.emailVerifyCodeSentAt || !user.emailVerifyCode) {
      throw new BadRequestException('Verification code not requested');
    }
    if (user.emailVerifyCode !== code) {
      throw new BadRequestException('Please enter valid OTP to continue');
    }

    const diffSec = (Date.now() - user.emailVerifyCodeSentAt.getTime()) / 1000;
    if (diffSec > 60)
      throw new BadRequestException('Verification code expired');

    user.emailVerifyCode = null;
    user.emailVerifyCodeSentAt = null;
    await this.userRepo.save(user);

    return { emailVerificationToken: this.signEmailVerificationToken(user.id) };
  }

  // ---------------- REGISTER INIT ----------------
  async registerInit(emailVerificationToken: string) {
    const { rpName, rpID } = this.webAuthnCfg;

    let payload: EmailTokenPayload;
    try {
      payload = this.jwtService.verify(
        emailVerificationToken,
      ) as EmailTokenPayload;
    } catch (error) {
      throw new BadRequestException(
        'Invalid or expired email verification token',
      );
    }
    if (payload.type !== 'email-verify') {
      throw new BadRequestException('Invalid email verification token');
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      relations: ['passkeys'],
    });

    if (!user) {
      throw new NotFoundException(
        'Please enter valid email to access the wallet',
      );
    }

    try {
      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: Uint8Array.from(Buffer.from(user.id.toString())),
        userName: user.email,
        timeout: 60000,
        attestationType: 'none',
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'required',
          userVerification: 'preferred',
        },
        excludeCredentials: (user.passkeys ?? []).map((p) => ({
          id: p.credentialId,
          transports: (p.transports as any) ?? undefined,
        })),
      });

      user.currentChallenge = options.challenge;
      await this.userRepo.save(user);

      return {
        temporaryAuthenticationToken: this.signTempToken(user.id, 'register'),
        publicKey: options,
      };
    } catch (error) {
      console.error('Error generating registration options:', error);
      throw new InternalServerErrorException(
        'Failed to initialize passkey registration',
      );
    }
  }

  // ---------------- REGISTER COMPLETE ----------------
  async registerComplete(
    temporaryAuthenticationToken: string,
    firstFactorCredential: any,
  ) {
    const { origins, rpIDs } = this.webAuthnCfg;

    let payload: TempTokenPayload;
    try {
      payload = this.jwtService.verify(
        temporaryAuthenticationToken,
      ) as TempTokenPayload;
    } catch (error) {
      throw new BadRequestException('Invalid or expired token');
    }
    if (payload.type !== 'register') {
      throw new BadRequestException('Invalid registration token');
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
    });
    if (!user || !user.currentChallenge) {
      throw new BadRequestException('No registration in progress');
    }

    const clientOrigin = this.parseClientOrigin(firstFactorCredential);
    const expectedRPID = this.chooseExpectedRpId(clientOrigin, rpIDs);

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response: firstFactorCredential,
        expectedChallenge: user.currentChallenge,
        expectedOrigin: origins, // ✅ accepts array
        expectedRPID, // ✅ must be string
      });
    } catch (error) {
      throw new BadRequestException('Passkey verification failed');
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Registration verification failed');
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    try {
      const passkey = this.passkeyRepo.create({
        userId: user.id,
        credentialId: credential.id,
        publicKey: base64url.encode(Buffer.from(credential.publicKey)),
        counter: credential.counter ?? 0,
        transports: credential.transports ?? undefined,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
      });

      // ✅ clear challenge + verification data
      user.isEmailVerified = true;
      user.currentChallenge = null;
      user.emailVerifyCode = null;
      user.emailVerifyCodeSentAt = null;

      await this.userRepo.save(user);
      await this.twoFactorService.ensureRow(user.id);
      // ✅ Upsert passkey
      const existing = await this.passkeyRepo.findOne({
        where: { userId: user.id, credentialId: credential.id },
      });

      if (existing) {
        existing.publicKey = passkey.publicKey;
        existing.counter = passkey.counter;
        existing.transports = passkey.transports;
        existing.deviceType = passkey.deviceType;
        existing.backedUp = passkey.backedUp;
        await this.passkeyRepo.save(existing);
      } else {
        await this.passkeyRepo.save(passkey);
      }

      const accessToken = this.signAccessToken(user);

      // DB first wallet check
      let wallet = await this.walletRepo.findOne({
        where: { userId: user.id },
      });

      if (!wallet) {
        try {
          const kyc = await this.userKycRepo.findOne({
            where: { email: user.email },
          });

          const providerWallet = await this.walletService.userWalletCreation(
            user.id,
          );

          wallet = this.walletRepo.create({
            userId: user.id,
            kycId: kyc?.id ?? null,
            walletId: providerWallet.walletId,
            address: providerWallet.address ?? null,
            status: WalletStatus.ACTIVE,
          });

          await this.walletRepo.save(wallet);
        } catch (walletError) {
          console.error('Wallet creation failed:', walletError);
        }
      }

      return {
        accessToken,
      };
    } catch (error) {
      console.error('Error saving user or passkey:', error);
      throw new InternalServerErrorException(
        'Failed to complete passkey registration',
      );
    }
  }

  // ---------------- LOGIN INIT ----------------
  async loginInit(email: string) {
    const { rpID } = this.webAuthnCfg;
    const normalized = email.toLowerCase().trim();

    // 1) Fetch auth user + passkeys first (to check deleted/disabled)
    const user = await this.userRepo.findOne({
      where: { email: normalized },
      relations: ['passkeys'],
    });

    if (!user) {
      throw new NotFoundException('No account found for this email address.');
    }

    // ✅ "deleted/disabled" check (you only have isActive)
    if (!user.isActive) {
      throw new ForbiddenException(
        'This account is deactivated. If you believe this is a mistake, please contact support.',
      );
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException(
        'Your registration is not complete. Please verify your email to activate your account.',
      );
    }

    if (!user.passkeys?.length) {
      throw new NotFoundException(
        'Passkey login is not set up for this account. Please register a passkey to continue.',
      );
    }

    // 2) Get KYC status (after user checks)
    const kyc = await this.kycService.getStatus(normalized);

    const blockedStatuses: KycReviewStatus[] = ['Rejected', 'FinallyRejected'];
    const needsKycStatuses: KycReviewStatus[] = ['Init', 'Incomplete'];

    if (blockedStatuses.includes(kyc.reviewStatus)) {
      throw new ForbiddenException(
        'Your verification was not approved. Please resubmit your KYC details or contact support for assistance.',
      );
    }

    if (needsKycStatuses.includes(kyc.reviewStatus)) {
      throw new ForbiddenException(
        'Your verification is incomplete. Please complete your KYC to continue.',
      );
    }

    // Strict mode: allow login only when Approved
    if (kyc.reviewStatus !== 'Approved') {
      throw new ForbiddenException(
        'Your verification is currently under review. Please try again later.',
      );
    }

    // 3) Build WebAuthn login options
    const options = await generateAuthenticationOptions({
      timeout: 60000,
      rpID,
      userVerification: 'preferred',
      allowCredentials: user.passkeys.map((p) => ({
        id: p.credentialId,
        transports: (Array.isArray(p.transports) && p.transports.length
          ? (p.transports as any)
          : ['internal']) as any,
      })),
    });

    // 4) Save challenge
    user.currentChallenge = options.challenge;
    await this.userRepo.save(user);

    // 5) Return
    return {
      accountType: kyc?.accountType ?? null,
      temporaryAuthenticationToken: this.signTempToken(user.id, 'login'),
      publicKey: options,
    };
  }

  // ---------------- LOGIN COMPLETE ----------------
  async loginComplete(
    temporaryAuthenticationToken: string,
    assertionResponse: any,
  ) {
    const { origins, rpIDs } = this.webAuthnCfg;
    // 1) Validate inputs
    if (
      !temporaryAuthenticationToken ||
      typeof temporaryAuthenticationToken !== 'string'
    ) {
      throw new BadRequestException('Missing temporaryAuthenticationToken');
    }
    if (!assertionResponse || typeof assertionResponse !== 'object') {
      throw new BadRequestException('Missing assertionResponse');
    }
    if (!assertionResponse.id || typeof assertionResponse.id !== 'string') {
      throw new BadRequestException('Invalid assertionResponse: missing id');
    }
    if (
      !assertionResponse.response ||
      typeof assertionResponse.response !== 'object'
    ) {
      throw new BadRequestException(
        'Invalid assertionResponse: missing response',
      );
    }

    // 2) Verify temp token
    let payload: TempTokenPayload;
    try {
      payload = this.jwtService.verify(
        temporaryAuthenticationToken,
      ) as TempTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired login token');
    }
    if (payload.type !== 'login') {
      throw new BadRequestException('Invalid token type');
    }
    if (!payload.sub) {
      throw new BadRequestException('Invalid token payload');
    }

    // 3) Load user + passkeys
    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      relations: ['passkeys'],
    });

    if (!user) throw new NotFoundException('User not found');
    if (!user.currentChallenge) {
      throw new BadRequestException(
        'No login in progress. Please start login again.',
      );
    }
    if (!user.passkeys?.length) {
      throw new BadRequestException('No passkeys registered for this user');
    }

    // 4) Find stored passkey by credential id
    const used = user.passkeys.find(
      (p) => p.credentialId === assertionResponse.id,
    );
    if (!used) {
      throw new UnauthorizedException(
        'Passkey not recognized. Please try again.',
      );
    }
    if (!used.publicKey) {
      throw new InternalServerErrorException(
        'Stored passkey is invalid (missing public key)',
      );
    }

    const clientOrigin = this.parseClientOrigin(assertionResponse);
    const expectedRPID = this.chooseExpectedRpId(clientOrigin, rpIDs);

    // 5) Verify assertion
    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response: assertionResponse,
        expectedChallenge: user.currentChallenge,
        expectedOrigin: origins, // ✅ accepts array
        expectedRPID, // ✅ must be string
        credential: {
          id: used.credentialId,
          publicKey: Uint8Array.from(base64url.toBuffer(used.publicKey)),
          counter: used.counter ?? 0,
          transports: (used.transports as any) ?? undefined,
        },
      });
    } catch (err: any) {
      const msg =
        typeof err?.message === 'string' && err.message.trim()
          ? err.message
          : 'Authentication verification failed';
      throw new UnauthorizedException(msg);
    }

    if (!verification?.verified) {
      throw new UnauthorizedException('Authentication failed');
    }

    // 6) Update counter safely
    const newCounter = verification.authenticationInfo?.newCounter;
    if (typeof newCounter === 'number') {
      used.counter = newCounter;
      await this.passkeyRepo.save(used);
    }

    // 7) Clear challenge
    user.currentChallenge = null;
    await this.userRepo.save(user);

    // clear challenge already done above

    // ✅ if 2FA enabled -> send OTP and do NOT issue accessToken yet
    const twoFaEnabled = await this.twoFactorService.isEnabled(user.id);
    if (twoFaEnabled) {
      await this.twoFactorService.sendLoginOtp(user);

      // optional: defer post-login work until final token issued
      return {
        twoFactorRequired: true,
        temporaryTwoFactorToken: this.signTempToken(user.id, '2fa-login'),
        message: 'OTP sent to your email. Please verify to complete login.',
      };
    }

    const accessToken = this.signAccessToken(user);
    // ✅ 2FA not enabled -> normal behavior

    let wallet = await this.walletRepo.findOne({
      where: { userId: user.id },
    });

    if (!wallet) {
      const kyc = await this.userKycRepo.findOne({
        where: { email: user.email },
      });

      const providerWallet = await this.walletService.userWalletCreation(
        user.id,
      );

      wallet = this.walletRepo.create({
        userId: user.id,
        kycId: kyc?.id ?? null,
        walletId: providerWallet.walletId,
        address: providerWallet.address ?? null,
        status: WalletStatus.ACTIVE,
      });

      await this.walletRepo.save(wallet);
    }
    console.log(
      accessToken,
      '===================================access=========================',
    );
    return { accessToken };
  }

  async loginTwoFaVerify(temporaryTwoFactorToken: string, code: string) {
    let payload: TempTokenPayload;

    try {
      payload = this.jwtService.verify(
        temporaryTwoFactorToken,
      ) as TempTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA token');
    }

    if (payload.type !== '2fa-login') {
      throw new BadRequestException('Invalid token type for 2FA login');
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) throw new ForbiddenException('Account is deactivated');

    // ✅ verify OTP stored in 2FA entity
    await this.twoFactorService.verifyLoginOtp(user.id, code);

    // ✅ issue final access token
    const accessToken = this.signAccessToken(user);

    return { accessToken };
  }

  // ---------------- RESET: SEND EMAIL CODE ----------------
  async sendResetEmailCode(email: string) {
    const normalized = email.toLowerCase().trim();
    const user = await this.userRepo.findOne({
      where: { email: ILike(normalized) },
    });

    if (!user) throw new NotFoundException('Please start from create process');

    if (!user.isEmailVerified) {
      throw new BadRequestException(
        'Email is not verified yet. Please register first.',
      );
    }

    if (user.emailVerifyCodeSentAt) {
      const diffSec =
        (Date.now() - user.emailVerifyCodeSentAt.getTime()) / 1000;
      if (diffSec < 30) {
        throw new BadRequestException(
          `Please wait ${Math.ceil(
            30 - diffSec,
          )} seconds before requesting a new code`,
        );
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerifyCode = code;
    user.emailVerifyCodeSentAt = new Date();
    await this.userRepo.save(user);

    await this.mailService.sendAuthCodeEmail({
      to: normalized,
      data: {
        username: normalized,
        verificationCode: code,
        expiryMinutes: 1,
        type: 'reset_passkey',
      },
    });

    return { success: true, message: 'Reset verification code sent' };
  }

  // ---------------- RESET: VERIFY EMAIL CODE ----------------
  async verifyResetEmailCode(email: string, code: string) {
    const normalized = email.toLowerCase().trim();
    const user = await this.userRepo.findOne({ where: { email: normalized } });

    if (!user) throw new NotFoundException('Please start from create process');
    if (!user.isEmailVerified) {
      throw new BadRequestException(
        'Email is not verified yet. Please register first.',
      );
    }

    if (!user.emailVerifyCodeSentAt || !user.emailVerifyCode) {
      throw new BadRequestException('Verification code not requested');
    }
    if (user.emailVerifyCode !== code) {
      throw new BadRequestException('Invalid email verification code');
    }

    const diffSec = (Date.now() - user.emailVerifyCodeSentAt.getTime()) / 1000;
    if (diffSec > 60)
      throw new BadRequestException('Verification code expired');

    user.emailVerifyCode = null;
    user.emailVerifyCodeSentAt = null;
    await this.userRepo.save(user);

    return {
      resetEmailVerificationToken: this.signResetEmailVerificationToken(
        user.id,
      ),
    };
  }

  // ---------------- RESET PASSKEY INIT ----------------
  async resetPasskeyInit(resetEmailVerificationToken: string) {
    const { rpName, rpID } = this.webAuthnCfg;

    let payload: ResetEmailTokenPayload;

    try {
      payload = this.jwtService.verify(
        resetEmailVerificationToken,
      ) as ResetEmailTokenPayload;
    } catch {
      throw new BadRequestException('Invalid reset email verification token');
    }
    if (payload.type !== 'reset-email-verify') {
      throw new BadRequestException('Invalid reset email verification token');
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      relations: ['passkeys'],
    });
    if (!user) throw new NotFoundException('User not found');

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Uint8Array.from(Buffer.from(user.id.toString())),
      userName: user.email,
      timeout: 60000,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'preferred',
      },
      excludeCredentials: (user.passkeys ?? []).map((p) => ({
        id: p.credentialId,
        transports: (p.transports as any) ?? undefined,
      })),
    });

    user.currentChallenge = options.challenge;
    await this.userRepo.save(user);

    return {
      temporaryAuthenticationToken: this.signTempToken(user.id, 'reset'),
      publicKey: options,
    };
  }

  // ---------------- RESET PASSKEY COMPLETE ----------------
  async resetPasskeyComplete(
    temporaryAuthenticationToken: string,
    firstFactorCredential: any,
  ) {
    const { origins, rpIDs } = this.webAuthnCfg;
    let payload: TempTokenPayload;
    try {
      payload = this.jwtService.verify(
        temporaryAuthenticationToken,
      ) as TempTokenPayload;
    } catch {
      throw new BadRequestException('Invalid token');
    }
    if (payload.type !== 'reset')
      throw new BadRequestException('Invalid token');

    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      relations: ['passkeys'],
    });
    if (!user || !user.currentChallenge) {
      throw new BadRequestException('No reset in progress');
    }

    const clientOrigin = this.parseClientOrigin(firstFactorCredential);
    const expectedRPID = this.chooseExpectedRpId(clientOrigin, rpIDs);

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response: firstFactorCredential,
        expectedChallenge: user.currentChallenge,
        expectedOrigin: origins, // ✅ accepts array
        expectedRPID, // ✅ must be string
      });
    } catch {
      throw new BadRequestException('Reset registration failed');
    }

    if (!verification.verified) {
      throw new BadRequestException('Reset registration failed');
    }
    if (!verification.registrationInfo) {
      throw new BadRequestException('Missing registrationInfo');
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    await this.passkeyRepo.delete({ userId: user.id });

    const newPasskey = this.passkeyRepo.create({
      userId: user.id,
      credentialId: credential.id,
      publicKey: base64url.encode(Buffer.from(credential.publicKey)),
      counter: credential.counter ?? 0,
      transports: credential.transports ?? undefined,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    });

    await this.userRepo.update(
      { id: user.id },
      {
        currentChallenge: null,
        isEmailVerified: true,
        emailVerifyCode: null,
        emailVerifyCodeSentAt: null,
      },
    );
    await this.passkeyRepo.save(newPasskey);

    const freshUser = await this.userRepo.findOneOrFail({
      where: { id: user.id },
    });

    return { accessToken: this.signAccessToken(freshUser) };
  }

  async twoFaToggleInit(req: CustomRequest) {
    const { email } = req.user;
    console.log('Extracted email from token:', email);
    const { rpID } = this.webAuthnCfg;
    const normalized = email.toLowerCase().trim();

    const user = await this.userRepo.findOne({
      where: { email: normalized },
      relations: ['passkeys'],
    });

    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) throw new ForbiddenException('Account is deactivated');
    if (!user.isEmailVerified)
      throw new ForbiddenException('Registration is not complete');

    // must have passkey
    if (!user.passkeys?.length) {
      throw new NotFoundException(
        'No passkey found. Please register a passkey first.',
      );
    }

    // Build WebAuthn auth options (prove ownership of passkey)
    const options = await generateAuthenticationOptions({
      timeout: 60000,
      rpID,
      userVerification: 'preferred',
      allowCredentials: user.passkeys.map((p) => ({
        id: p.credentialId,
        transports: (Array.isArray(p.transports) && p.transports.length
          ? (p.transports as any)
          : ['internal']) as any,
      })),
    });

    user.currentChallenge = options.challenge;
    await this.userRepo.save(user);

    // token type for toggle
    return {
      temporaryAuthenticationToken: this.signTempToken(user.id, '2fa-toggle'),
      publicKey: options,
    };
  }

  async twoFaToggleComplete(
    temporaryAuthenticationToken: string,
    enabled: boolean,
    assertionResponse: any,
  ) {
    const { origins, rpIDs } = this.webAuthnCfg;

    let payload: TempTokenPayload;
    try {
      payload = this.jwtService.verify(
        temporaryAuthenticationToken,
      ) as TempTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.type !== '2fa-toggle') {
      throw new BadRequestException('Invalid token type for 2FA toggle');
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      relations: ['passkeys'],
    });

    if (!user) throw new NotFoundException('User not found');
    if (!user.currentChallenge)
      throw new BadRequestException('No toggle in progress');
    if (!user.passkeys?.length)
      throw new BadRequestException('Passkey is required to toggle 2FA');

    // Find passkey used
    const used = user.passkeys.find(
      (p) => p.credentialId === assertionResponse.id,
    );
    if (!used) {
      throw new UnauthorizedException(
        'Passkey not recognized. Please try again.',
      );
    }
    if (!used.publicKey) {
      throw new InternalServerErrorException(
        'Stored passkey is invalid (missing public key)',
      );
    }

    const clientOrigin = this.parseClientOrigin(assertionResponse);
    const expectedRPID = this.chooseExpectedRpId(clientOrigin, rpIDs);

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response: assertionResponse,
        expectedChallenge: user.currentChallenge,
        expectedOrigin: origins,
        expectedRPID,
        credential: {
          id: used.credentialId,
          publicKey: Uint8Array.from(base64url.toBuffer(used.publicKey)),
          counter: used.counter ?? 0,
          transports: (used.transports as any) ?? undefined,
        },
      });
    } catch (err: any) {
      throw new UnauthorizedException(
        err?.message || 'Passkey verification failed',
      );
    }

    if (!verification?.verified)
      throw new UnauthorizedException('Passkey verification failed');

    // update counter
    const newCounter = verification.authenticationInfo?.newCounter;
    if (typeof newCounter === 'number') {
      used.counter = newCounter;
      await this.passkeyRepo.save(used);
    }

    // clear challenge
    user.currentChallenge = null;
    await this.userRepo.save(user);

    // ✅ finally toggle 2FA (requires passkey already checked here)
    const res = await this.twoFactorService.setEnabled(user.id, enabled);
    return { success: true, ...res };
  }
}
