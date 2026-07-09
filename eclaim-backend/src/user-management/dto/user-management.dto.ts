import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsString } from 'class-validator';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/typescript-types';

/**
 * NOTE:
 * - For WebAuthn JSON objects, Swagger can't fully infer the TS type at runtime.
 * - We document them with `type: 'object'` + an example payload shape.
 */

export class CreateUserDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email (will be normalized to lowercase).',
  })
  @IsEmail()
  email: string;
}

export class SendEmailCodeDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email to send OTP code.',
  })
  @IsEmail()
  email: string;
}

export class VerifyEmailCodeDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email used to request the OTP.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'OTP code sent to email.',
  })
  @IsString()
  code: string;
}

export class RegisterInitDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....',
    description: 'Token returned by /verify-email-code (type=email-verify).',
  })
  @IsString()
  emailVerificationToken: string;
}

export class RegisterCompleteDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....',
    description: 'Temporary token returned by /register/init (type=register).',
  })
  @IsString()
  temporaryAuthenticationToken: string;

  @ApiProperty({
    type: 'object',
    description:
      'WebAuthn RegistrationResponseJSON from @simplewebauthn/browser startRegistration().',
    example: {
      id: 'Y2hhbmdlbWU',
      rawId: 'Y2hhbmdlbWU',
      type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON:
          'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiLi4uIn0',
        attestationObject: 'o2NmbXRkbm9uZQ',
        transports: ['internal'],
      },
    },
  })
  firstFactorCredential: RegistrationResponseJSON;
}

export class LoginInitDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email of user to login with passkey.',
  })
  @IsEmail()
  email: string;
}

export class LoginCompleteDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....',
    description: 'Temporary token returned by /login/init (type=login).',
  })
  @IsString()
  temporaryAuthenticationToken: string;

  @ApiProperty({
    type: 'object',
    description:
      'WebAuthn AuthenticationResponseJSON from @simplewebauthn/browser startAuthentication().',
    example: {
      id: 'Y2hhbmdlbWU',
      rawId: 'Y2hhbmdlbWU',
      type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON:
          'eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiLi4uIn0',
        authenticatorData: 'SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2M',
        signature: 'MEUCIQDv...snip...',
        userHandle: null,
      },
    },
  })
  assertionResponse: AuthenticationResponseJSON;
}

/** ✅ Reset init uses resetEmailVerificationToken */
export class ResetPasskeyInitDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....',
    description:
      'Token returned by /reset/verify-email-code (type=reset-email-verify).',
  })
  @IsString()
  resetEmailVerificationToken: string;
}

export class ResetPasskeyCompleteDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....',
    description:
      'Temporary token returned by /reset-passkey/init (type=reset).',
  })
  @IsString()
  temporaryAuthenticationToken: string;

  @ApiProperty({
    type: 'object',
    description:
      'WebAuthn RegistrationResponseJSON from @simplewebauthn/browser startRegistration() during reset.',
    example: {
      id: 'Y2hhbmdlbWU',
      rawId: 'Y2hhbmdlbWU',
      type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON:
          'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiLi4uIn0',
        attestationObject: 'o2NmbXRkbm9uZQ',
        transports: ['internal'],
      },
    },
  })
  firstFactorCredential: RegistrationResponseJSON;
}

export class TwoFaToggleCompleteDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....',
    description:
      'Temporary token returned by /2fa/toggle/init (type=2fa-toggle).',
  })
  @IsString()
  temporaryAuthenticationToken: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    type: 'object',
    description:
      'WebAuthn AuthenticationResponseJSON from @simplewebauthn/browser startAuthentication().',
    example: {
      id: 'Y2hhbmdlbWU',
      rawId: 'Y2hhbmdlbWU',
      type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON:
          'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiLi4uIn0',
        attestationObject: 'o2NmbXRkbm9uZQ',
        transports: ['internal'],
      },
    },
  })
  assertionResponse: AuthenticationResponseJSON;
}

export class LoginTwoFaVerifyDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....',
    description:
      'Temporary token returned by /login/complete when 2FA is enabled (type=2fa-login).',
  })
  @IsString()
  temporaryTwoFactorToken: string;

  @ApiProperty({ example: '123456', description: 'OTP sent to email.' })
  @IsString()
  code: string;
}
