import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from 'src/database/entities/users.entity';
import { UserTwoFactor } from 'src/database/entities/user-two-factor.entity';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class TwoFactorService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserTwoFactor)
    private readonly twoFaRepo: Repository<UserTwoFactor>,
    private readonly mailService: MailService,
  ) {}

  async ensureRow(userId: number) {
    const existing = await this.twoFaRepo.findOne({ where: { userId } });
    if (existing) return existing;

    const row = this.twoFaRepo.create({
      userId,
      enabled: false,
      emailOtpCode: null,
      emailOtpSentAt: null,
      emailOtpExpiresAt: null,
    });
    return this.twoFaRepo.save(row);
  }

  async isEnabled(userId: number) {
    const row = await this.ensureRow(userId);
    return !!row.enabled;
  }

  async setEnabled(userId: number, enabled: boolean) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['passkeys'],
    });
    if (!user) throw new NotFoundException('User not found');

    // ✅ you said: to enable/disable passkey is required
    if (!user.passkeys?.length) {
      throw new BadRequestException(
        'Passkey is required to enable/disable 2FA',
      );
    }

    const row = await this.ensureRow(userId);
    row.enabled = enabled;

    // tidy when disabling
    if (!enabled) {
      row.emailOtpCode = null;
      row.emailOtpSentAt = null;
      row.emailOtpExpiresAt = null;
    }

    await this.twoFaRepo.save(row);
    return { enabled: row.enabled };
  }

  /**
   * ✅ Generate and send OTP for login 2FA step
   */
  async sendLoginOtp(user: User) {
    const row = await this.ensureRow(user.id);

    // throttle (optional)
    if (row.emailOtpSentAt) {
      const diffSec = (Date.now() - row.emailOtpSentAt.getTime()) / 1000;
      if (diffSec < 30) {
        throw new BadRequestException(
          `Please wait ${Math.ceil(
            30 - diffSec,
          )} seconds before requesting OTP again`,
        );
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes

    row.emailOtpCode = code;
    row.emailOtpSentAt = now;
    row.emailOtpExpiresAt = expiresAt;

    await this.twoFaRepo.save(row);

    await this.mailService.sendAuthCodeEmail({
      to: user.email,
      data: {
        username: user.email,
        verificationCode: code,
        expiryMinutes: 2,
        type: 'login_2fa',
      },
    });

    return { success: true };
  }

  async verifyLoginOtp(userId: number, code: string) {
    const row = await this.ensureRow(userId);

    if (!row.enabled) {
      throw new BadRequestException('2FA is not enabled');
    }
    if (!row.emailOtpCode || !row.emailOtpExpiresAt) {
      throw new BadRequestException('OTP not requested');
    }
    if (row.emailOtpCode !== code) {
      throw new BadRequestException('Invalid OTP');
    }
    if (new Date() > row.emailOtpExpiresAt) {
      throw new BadRequestException('OTP expired');
    }

    // clear after success
    row.emailOtpCode = null;
    row.emailOtpSentAt = null;
    row.emailOtpExpiresAt = null;
    await this.twoFaRepo.save(row);

    return { success: true };
  }
}
