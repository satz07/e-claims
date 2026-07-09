import {
  BadRequestException,
  Injectable,
  // Logger,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import {
  KycReviewStatus,
  UserKyc,
} from 'src/database/entities/user-kyc.entity';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { CreateUserStep2Dto } from './dto/create-user-step2.dto';
import { CreateUserStep1Dto } from './dto/create-user-step1.dto';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from 'src/config/config.type';
import { InitKycDto } from './dto/init-kyc.dto';
import { User } from 'src/database/entities/users.entity';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class KYCService {
  // private readonly logger = new Logger(KYCService.name);
  private readonly sumsub;

  constructor(
    @InjectRepository(UserKyc) private readonly repo: Repository<UserKyc>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,

    private readonly configService: ConfigService<AllConfigType>,
    private readonly mailService: MailService,
  ) {
    // ✅ Load Sumsub config once
    this.sumsub = this.configService.get('sumsub', { infer: true });

    if (!this.sumsub) {
      throw new Error('Sumsub configuration is missing');
    }
  }

  // ----------------------------------------SUBSUM INTEGRATION----------------------------------------
  private async getOrCreate(email: string, levelName: string) {
    let rec = await this.repo.findOne({ where: { email } });
    if (!rec) {
      rec = this.repo.create({
        email,
        levelName: levelName,
        reviewStatus: 'Init',
      });
      rec = await this.repo.save(rec);
    } else if (levelName && rec.levelName !== levelName) {
      rec.levelName = levelName;
      rec = await this.repo.save(rec);
    }
    return rec;
  }

  /** STEP 1 */
  async createStep1(dto: CreateUserStep1Dto) {
    const response = { status: '', message: '' };
    const email = dto.email.toLowerCase().trim();

    // 1️⃣ Check if KYC already exists
    const existingUser = await this.repo.findOne({
      where: { email },
    });

    if (existingUser) {
      // ✅ Check if app registration is already complete (passkey exists)
      const authUser = await this.userRepo.findOne({
        where: { email },
        relations: ['passkeys'],
      });

      const isRegistered = !!authUser?.passkeys?.length;
      const isVerified = !!authUser?.isEmailVerified;

      if (isRegistered && isVerified) {
        return {
          status: existingUser.reviewStatus,
          registered: true,
          verified: true,
          message:
            'You are already registered and verified. Please login using your passkey.',
        };
      }

      // otherwise continue your existing KYC status responses
      response.status = existingUser.reviewStatus;

      switch (existingUser.reviewStatus) {
        case 'Incomplete':
          response.message =
            'KYC already exists. You can continue the process.';
          return {
            ...response,
            registered: isRegistered,
            verified: isVerified,
          };

        case 'Init':
          response.message =
            'KYC already initiated but not completed. Please continue the process.';
          return {
            ...response,
            registered: isRegistered,
            verified: isVerified,
          };

        case 'Approved':
          response.message =
            'Your KYC is approved. Please complete registration and verify your email to continue.';
          return {
            ...response,
            registered: isRegistered,
            verified: isVerified,
          };

        case 'Pending':
          response.message = 'KYC already initiated and pending for review.';
          return {
            ...response,
            registered: isRegistered,
            verified: isVerified,
          };

        case 'Rejected':
          response.message =
            'KYC was rejected. Please contact support or try again.';
          return {
            ...response,
            registered: isRegistered,
            verified: isVerified,
          };

        default:
          response.message = `KYC already exists with status: ${existingUser.reviewStatus}`;
          return {
            ...response,
            registered: isRegistered,
            verified: isVerified,
          };
      }
    }

    // 2️⃣ Fresh KYC → create new record
    const newUser = this.repo.create({
      email,
      phoneNumber: dto.phoneNumber,
      reviewStatus: 'Init',
    });

    const savedUser = await this.repo.save(newUser);

    return {
      status: savedUser.reviewStatus,
      registered: false,
      verified: false,
      message: 'KYC initiated successfully.',
    };
  }

  /** STEP 2 */
  async createStep2(dto: CreateUserStep2Dto) {
    const user = await this.repo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If accountType already exists, skip all updates
    if (user.accountType && user.accountType.trim() !== '') {
      return user;
    }

    let updated = false;

    if (!user.accountType || user.accountType.trim() === '') {
      // Normalize to 'Individual' or 'Business'
      user.accountType =
        dto.accountType.toLowerCase() === 'business'
          ? 'Business'
          : 'Individual';
      updated = true;
    }

    // Set levelName based on accountType
    if (dto.accountType === 'Individual') {
      user.levelName = 'ADI-level';
    } else {
      user.levelName = 'ADI-level-business';
    }

    if (!user.reviewStatus || user.reviewStatus.trim() === '') {
      user.reviewStatus =
        dto.accountType === 'Individual' ? 'Incomplete' : 'Pending';
      updated = true;
    }

    // Save only if any field was updated
    if (updated) {
      return this.repo.save(user);
    }

    return user;
  }

  private nameFromEmail(email: string) {
    const local = email.split('@')[0]; // saqib.altaf
    const parts = local.split(/[._-]/);

    const capitalize = (v: string) =>
      v ? v.charAt(0).toUpperCase() + v.slice(1) : 'User';

    return {
      firstName: capitalize(parts[0]),
      lastName: capitalize(parts[1] ?? 'User'),
    };
  }

  /**
   * Mint a Sumsub SDK access token if KYC is NOT Approved.
   * If already Approved, throws unless `force` is true.
   */
  async initApplicant(dto: InitKycDto) {
    const { type, email, levelName, force } = dto;

    if (type === 'KYC') {
      if (!email) throw new BadRequestException('Email is required for KYC');

      const rec = await this.getOrCreate(email.toLowerCase(), levelName);

      if (rec.reviewStatus === 'Approved' && !force) {
        throw new BadRequestException('KYC already approved for this email.');
      }

      const userId = String(rec.userIdForSumsub ?? rec.id);

      // Derive name from email if first/last not provided
      const name = {
        firstName: this.nameFromEmail(email).firstName,
        lastName: this.nameFromEmail(email).lastName,
      };

      // 1️⃣ CREATE APPLICANT (ONLY ONCE)
      if (!rec.userIdForSumsub) {
        const applicantPath = `/resources/applicants?levelName=${rec.levelName}`;
        const applicantBody = JSON.stringify({
          externalUserId: userId,
          info: { email, ...name },
        });

        const ts = Math.floor(Date.now() / 1000).toString();
        const sig = crypto
          .createHmac('sha256', this.sumsub.secretKey)
          .update(ts + 'POST' + applicantPath + applicantBody)
          .digest('hex');

        const res = await fetch(`${this.sumsub.rootUrl}${applicantPath}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-App-Token': this.sumsub.appToken,
            'X-App-Access-Sig': sig,
            'X-App-Access-Ts': ts,
          },
          body: applicantBody,
        });

        let responseBody: any;
        try {
          responseBody = await res.json();
        } catch {
          responseBody = await res.text();
        }

        console.log('Sumsub create applicant response:', {
          status: res.status,
          ok: res.ok,
          body: responseBody,
        });

        if (!res.ok) {
          throw new BadRequestException(
            `Sumsub applicant error ${res.status}: ${JSON.stringify(
              responseBody,
            )}`,
          );
        }

        rec.userIdForSumsub = userId;
        rec.applicantId = responseBody.id;
        await this.repo.save(rec);
      }

      // 2️⃣ GENERATE SDK TOKEN
      const token = await this.generateSdkToken(userId, rec.levelName);

      return {
        type,
        email: rec.email,
        levelName: rec.levelName,
        reviewStatus: rec.reviewStatus,
        token,
      };
    } else if (type === 'KYB') {
      const rec = await this.getOrCreate(email.toLowerCase(), levelName);

      if (rec.reviewStatus === 'Approved' && !force) {
        throw new BadRequestException('KYB already approved for this company.');
      }

      const userId = String(rec.userIdForSumsub ?? rec.id);

      if (!rec.userIdForSumsub) {
        const applicantPath = `/resources/applicants?levelName=${rec.levelName}`;
        const applicantBody = JSON.stringify({
          externalUserId: userId,
        });

        const ts = Math.floor(Date.now() / 1000).toString();
        const sig = crypto
          .createHmac('sha256', this.sumsub.secretKey)
          .update(ts + 'POST' + applicantPath + applicantBody)
          .digest('hex');

        const res = await fetch(`${this.sumsub.rootUrl}${applicantPath}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-App-Token': this.sumsub.appToken,
            'X-App-Access-Sig': sig,
            'X-App-Access-Ts': ts,
          },
          body: applicantBody,
        });

        let responseBody: any;
        try {
          responseBody = await res.json();
        } catch {
          responseBody = await res.text();
        }

        console.log('Sumsub create applicant response:', {
          status: res.status,
          ok: res.ok,
          body: responseBody,
        });

        if (!res.ok) {
          throw new BadRequestException(
            `Sumsub applicant error ${res.status}: ${JSON.stringify(
              responseBody,
            )}`,
          );
        }

        rec.userIdForSumsub = userId;
        rec.applicantId = responseBody.id;
        await this.repo.save(rec);
      }

      const token = await this.generateSdkToken(userId, rec.levelName);

      return {
        type,
        levelName: rec.levelName,
        reviewStatus: rec.reviewStatus,
        token,
      };
    }

    throw new BadRequestException('Unknown applicant type');
  }

  private async generateSdkToken(userId: string, levelName?: string) {
    const path = '/resources/accessTokens/sdk';
    const body = JSON.stringify({ userId, levelName, ttlInSecs: 600 });
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = crypto
      .createHmac('sha256', this.sumsub.secretKey)
      .update(ts + 'POST' + path + body)
      .digest('hex');

    const res = await fetch(`${this.sumsub.rootUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Token': this.sumsub.appToken,
        'X-App-Access-Sig': sig,
        'X-App-Access-Ts': ts,
      },
      body,
    });

    if (!res.ok) {
      const t = await res.text();
      throw new BadRequestException(
        `Sumsub SDK token error ${res.status}: ${t}`,
      );
    }

    const data = await res.json();
    return data.token;
  }

  async getStatus(email: string) {
    const rec = await this.repo.findOne({
      where: { email: email.toLowerCase() },
    });
    if (!rec) {
      return {
        email: email.toLowerCase(),
        accountType: null,
        reviewStatus: 'Init' as KycReviewStatus,
        levelName: null,
        applicantId: null,
        id: null,
        updatedAt: null,
      };
    }
    return {
      email: rec.email,
      accountType: rec.accountType ?? null,
      reviewStatus: rec.reviewStatus,
      levelName: rec.levelName ?? null,
      applicantId: rec.applicantId ?? null,
      id: rec.id,
      updatedAt: rec.updatedAt,
    };
  }

  /**
   * Webhook handler—exact fix
   */
  async applyWebhook(
    eventType: string,
    applicantId: string,
    reviewResultMapped:
      | 'Approved'
      | 'Rejected'
      | 'FinallyRejected'
      | 'Pending'
      | 'Incomplete',
    externalUserId?: string,
    applicantType?: 'individual' | 'company',
  ) {
    try {
      const statusMap: Record<string, KycReviewStatus> = {
        Approved: 'Approved',
        FinallyRejected: 'FinallyRejected',
        Rejected: 'Rejected',
        Pending: 'Pending',
        Incomplete: 'Incomplete',
      };

      const newStatus: KycReviewStatus =
        statusMap[reviewResultMapped] ?? 'Pending';

      console.log('Webhook received:', {
        eventType,
        applicantId,
        reviewResultMapped,
        externalUserId,
        applicantType,
      });

      // 1) Link step: applicantCreated → match by externalUserId
      if (eventType === 'applicantCreated') {
        console.log('applicantCreated: linking applicantId to user record...', {
          applicantId,
          externalUserId,
          applicantType,
        });

        if (!externalUserId || !applicantId) return false;

        const rec =
          (await this.repo.findOne({
            where: { userIdForSumsub: String(externalUserId) },
          })) ||
          (await this.repo.findOne({ where: { id: Number(externalUserId) } }));
        console.log(
          'step 2 Matching record for linking:==========================================================================',
          rec,
        );
        if (!rec) return false;

        rec.applicantId = applicantId;
        console.log('step 3 Linking applicantId to user record...', rec);
        console.log(
          '==========================================================================...',
          applicantId,
          externalUserId,
        );
        // Store accountType mapped from Sumsub applicantType
        if (applicantType) {
          rec.accountType =
            applicantType === 'company' ? 'Business' : 'Individual';
        }

        if (!rec.userIdForSumsub) rec.userIdForSumsub = String(externalUserId);
        if (rec.reviewStatus === 'Init' || !rec.reviewStatus)
          rec.reviewStatus = 'Pending';

        const data = await this.repo.save(rec);
        console.log(
          applicantId,
          newStatus,
          'Step 4, processing update data...==========================================================================',
          data,
        );
        return true;
      }

      // 2) Review updates: find by applicantId and update status
      if (!applicantId) return false;

      const rec = await this.repo.findOne({ where: { applicantId } });
      if (!rec) return false;

      const prevStatus = rec.reviewStatus;
      rec.reviewStatus = newStatus;

      // Ensure accountType is synced if provided in webhook
      if (applicantType) {
        rec.accountType =
          applicantType === 'company' ? 'Business' : 'Individual';
      }

      // Save first (so DB is consistent even if email fails)
      const data = await this.repo.save(rec);
      console.log(
        'Step 5, review status updated in DB...==========================================================================',
        data,
      );
      // 3) If approved (KYC or KYB), send email (only once)
      const isApprovedNow = newStatus === 'Approved';
      const wasApprovedBefore = prevStatus === 'Approved';

      if (isApprovedNow && !wasApprovedBefore) {
        // Determine KYC vs KYB:
        // Prefer webhook applicantType, else fallback to whatever you store (if any)
        const type: 'individual' | 'company' =
          applicantType ??
          (rec.accountType === 'Business' ? 'company' : 'individual');

        const isKYB = type === 'company';
        const isKYC = type === 'individual';

        // Guard: must have email to send
        if (rec.email) {
          try {
            if (isKYB) {
              // ✅ KYB approved email
              await this.mailService.sendKybApprovedEmail({
                to: rec.email,
                // add anything you want in template data
                data: { username: rec.email },
              });
            } else if (isKYC) {
              // ✅ KYC approved email
              await this.mailService.sendKycApprovedEmail({
                to: rec.email,
                data: { username: rec.email },
              });
            }

            console.log('✅ Approval email sent:', {
              email: rec.email,
              type,
              applicantId,
            });
          } catch (mailErr) {
            console.log('⚠️ Approved but failed to send email:', mailErr);
            // don’t fail webhook because of email
          }
        } else {
          console.log('⚠️ Approved but no email found on record:', {
            applicantId,
          });
        }
      }

      console.log('✅ Review status updated:', {
        applicantId,
        prevStatus,
        newStatus,
      });
      return true;
    } catch (error) {
      console.log(error, 'Error processing webhook');
      return false;
    }
  }

  // ------------------------------------------END SUBSUM INTEGRATION----------------------------------------
}
