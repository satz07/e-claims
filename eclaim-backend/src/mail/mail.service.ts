import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

import { MailerService } from 'src/mailer/mailer.service';

import { MailData } from './interfaces/mail-data.interface';
import { AllConfigType } from 'src/config/config.type';
// import { RecallStatus } from 'src/batch_notification/dto/batch-recall-notify.dto';
@Injectable()
export class MailService {
  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly mailerService: MailerService,
  ) {}

  async sendAuthCodeEmail(
    mailData: MailData<{
      username: string;
      verificationCode: string;
      expiryMinutes?: number;
      type: 'verify' | 'reset_passkey' | 'login_2fa';
    }>,
  ): Promise<void> {
    const appEnv = this.configService.get('app.nodeEnv', { infer: true });
    const isProduction = appEnv === 'production';

    const emailConfig = {
      verify: {
        subject: 'Verify Your Email Address',
        title: 'Email Verification',
        template: 'email-verification.hbs',
      },
      reset_passkey: {
        subject: 'Reset Your Passkey',
        title: 'Reset Passkey',
        template: 'reset-email-verification.hbs',
      },
      login_2fa: {
        subject: 'Your Login Verification Code',
        title: 'Login Verification',
        template: 'login-2fa.hbs',
      },
    } as const;

    const cfg = emailConfig[mailData.data.type] ?? emailConfig.verify;

    const templatePath = isProduction
      ? path.join(__dirname, 'mail-templates', cfg.template)
      : path.join(
          this.configService.getOrThrow('app.workingDirectory', {
            infer: true,
          }),
          'src',
          'mail',
          'mail-templates',
          cfg.template,
        );

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: cfg.subject,
      templatePath,
      context: {
        app_name: 'Infinia Wallet',
        title: cfg.title,
        username: mailData.data.username,
        verificationCode: mailData.data.verificationCode,
        expiryMinutes: mailData.data.expiryMinutes || 10,
        logoCid: 'logo',
      },
      attachments: [
        {
          filename: 'logo.png',
          path: isProduction
            ? path.join(__dirname, '..', 'public', 'logo', 'logo.png')
            : path.join(
                this.configService.getOrThrow('app.workingDirectory', {
                  infer: true,
                }),
                'public',
                'logo',
                'logo.png',
              ),
          cid: 'logo',
        },
      ],
    });
  }

  async sendKycApprovedEmail(
    mailData: MailData<{
      username: string;
    }>,
  ): Promise<void> {
    await this.sendKycKybEmail(mailData, 'kyc');
  }

  async sendKybApprovedEmail(
    mailData: MailData<{
      username: string;
    }>,
  ): Promise<void> {
    await this.sendKycKybEmail(mailData, 'kyb');
  }

  private async sendKycKybEmail(
    mailData: MailData<{ username: string }>,
    type: 'kyc' | 'kyb',
  ): Promise<void> {
    const appEnv = this.configService.get('app.nodeEnv', { infer: true });
    const isProduction = appEnv === 'production';

    const emailConfig = {
      kyc: {
        subject: 'Your Identity Verification is Approved ✅',
        title: 'KYC Approved',
        template: 'kyc-approved.hbs',
      },
      kyb: {
        subject: 'Your Business Verification is Approved ✅',
        title: 'KYB Approved',
        template: 'kyb-approved.hbs',
      },
    } as const;

    const cfg = emailConfig[type];

    const templatePath = isProduction
      ? path.join(__dirname, 'mail-templates', cfg.template)
      : path.join(
          this.configService.getOrThrow('app.workingDirectory', {
            infer: true,
          }),
          'src',
          'mail',
          'mail-templates',
          cfg.template,
        );

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: cfg.subject,
      templatePath,
      context: {
        app_name: 'Infinia Wallet',
        title: cfg.title,
        username: mailData.data.username,
        logoCid: 'logo',
      },
      attachments: [
        {
          filename: 'logo.png',
          path: isProduction
            ? path.join(__dirname, '..', 'public', 'logo', 'logo.png')
            : path.join(
                this.configService.getOrThrow('app.workingDirectory', {
                  infer: true,
                }),
                'public',
                'logo',
                'logo.png',
              ),
          cid: 'logo',
        },
      ],
    });
  }
}
