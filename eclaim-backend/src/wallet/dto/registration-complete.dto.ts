import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
  Matches,
  MinLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';

// base64url regex (no + / =)
const B64URL = /^[A-Za-z0-9\-_]+$/;

// {} -> undefined
const EmptyToUndefined = () =>
  Transform(({ value }) =>
    value && Object.keys(value).length === 0 ? undefined : value,
  );

export class WebAuthnInfoDto {
  @ApiProperty({ example: 'YlNnQk5B...' })
  @IsString()
  @Matches(B64URL)
  credId!: string;
  @ApiProperty({ example: 'eyJ0eXAiOiJKV1Qi...' })
  @IsString()
  @Matches(B64URL)
  clientData!: string;
  @ApiProperty({ example: 'o2NmbXRk...' })
  @IsString()
  @Matches(B64URL)
  attestationData!: string;
}

export class Fido2FirstFactorCredentialDto {
  @ApiProperty({ enum: ['Fido2'] })
  @IsIn(['Fido2'] as const)
  @IsString()
  credentialKind!: 'Fido2';
  @ApiProperty({ type: () => WebAuthnInfoDto })
  @ValidateNested()
  @Type(() => WebAuthnInfoDto)
  credentialInfo!: WebAuthnInfoDto;
  @ApiPropertyOptional() @IsOptional() @IsString() credentialName?: string;
}

export class Fido2SecondFactorDto {
  @ApiProperty({ enum: ['Fido2'] })
  @IsIn(['Fido2'] as const)
  @IsString()
  credentialKind!: 'Fido2';
  @ApiProperty({ type: () => WebAuthnInfoDto })
  @ValidateNested()
  @Type(() => WebAuthnInfoDto)
  credentialInfo!: WebAuthnInfoDto;
  @ApiPropertyOptional() @IsOptional() @IsString() credentialName?: string;
}
export class KeySecondFactorDto {
  @ApiProperty({ enum: ['Key'] })
  @IsIn(['Key'] as const)
  @IsString()
  credentialKind!: 'Key';
  @ApiProperty({ type: () => WebAuthnInfoDto })
  @ValidateNested()
  @Type(() => WebAuthnInfoDto)
  credentialInfo!: WebAuthnInfoDto;
  @ApiPropertyOptional() @IsOptional() @IsString() credentialName?: string;
}
export class PasswordProtectedKeySecondFactorDto {
  @ApiProperty({ enum: ['PasswordProtectedKey'] })
  @IsIn(['PasswordProtectedKey'] as const)
  @IsString()
  credentialKind!: 'PasswordProtectedKey';
  @ApiProperty({ type: () => WebAuthnInfoDto })
  @ValidateNested()
  @Type(() => WebAuthnInfoDto)
  credentialInfo!: WebAuthnInfoDto;
  @ApiPropertyOptional() @IsOptional() @IsString() credentialName?: string;
}
export class TotpSecondFactorDto {
  @ApiProperty({ enum: ['Totp'] })
  @IsIn(['Totp'] as const)
  @IsString()
  credentialKind!: 'Totp';
  @ApiProperty({ example: { otp: '123456' }, additionalProperties: false })
  @IsObject()
  credentialInfo!: { otp: string };
  @ApiPropertyOptional() @IsOptional() @IsString() credentialName?: string;
}

export class RecoveryKeyCredentialDto {
  @ApiProperty({ enum: ['RecoveryKey'] })
  @IsIn(['RecoveryKey'] as const)
  @IsString()
  credentialKind!: 'RecoveryKey';
  @ApiProperty({ type: () => WebAuthnInfoDto })
  @ValidateNested()
  @Type(() => WebAuthnInfoDto)
  credentialInfo!: WebAuthnInfoDto;
  @ApiProperty({ example: 'K3JvJY...' })
  @IsString()
  @Matches(B64URL)
  encryptedPrivateKey!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() credentialName?: string;
}

export type SecondFactorUnion =
  | Fido2SecondFactorDto
  | KeySecondFactorDto
  | PasswordProtectedKeySecondFactorDto
  | TotpSecondFactorDto;

@ApiExtraModels(
  WebAuthnInfoDto,
  Fido2FirstFactorCredentialDto,
  Fido2SecondFactorDto,
  KeySecondFactorDto,
  PasswordProtectedKeySecondFactorDto,
  TotpSecondFactorDto,
  RecoveryKeyCredentialDto,
)
export class RegistrationCompleteDto {
  @ApiProperty({
    description: 'Temporary token from registrationInit',
    example: 'eyJ...',
  })
  @IsString()
  @IsNotEmpty()
  temporaryAuthenticationToken!: string;

  @ApiProperty({ type: () => Fido2FirstFactorCredentialDto })
  @ValidateNested()
  @Type(() => Fido2FirstFactorCredentialDto)
  firstFactorCredential!: Fido2FirstFactorCredentialDto;

  @ApiPropertyOptional({
    oneOf: [
      { $ref: getSchemaPath(Fido2SecondFactorDto) },
      { $ref: getSchemaPath(KeySecondFactorDto) },
      { $ref: getSchemaPath(PasswordProtectedKeySecondFactorDto) },
      { $ref: getSchemaPath(TotpSecondFactorDto) },
    ],
  })
  @IsOptional()
  @ValidateNested()
  @EmptyToUndefined()
  @Type(() => Object)
  secondFactorCredential?: SecondFactorUnion;

  // @ApiProperty({ type: () => RecoveryKeyCredentialDto })
  // @ValidateNested()
  // @Type(() => RecoveryKeyCredentialDto)
  // recoveryCredential!: RecoveryKeyCredentialDto;
}

/** PUT /registration/code */
export class ResendRegistrationCodeDto {
  @ApiProperty({ example: 'jane' })
  @IsString()
  @MinLength(1)
  username!: string;
}

/** POST /registration/init */
export class RegistrationInitDto {
  @ApiProperty({ example: 'jane' })
  @IsString()
  @MinLength(1)
  username!: string;

  @ApiProperty({ example: '1234-5678-9012-3456' })
  @IsString()
  @MinLength(4)
  registrationCode!: string;
}
