import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class SigningKeyDto {
  @ApiPropertyOptional({ description: 'Reuse existing key id' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ enum: ['DH', 'ECDSA', 'EdDSA', 'Schnorr'] })
  @IsOptional()
  @IsString()
  scheme?: 'DH' | 'ECDSA' | 'EdDSA' | 'Schnorr';

  @ApiPropertyOptional({ enum: ['ed25519', 'secp256k1', 'stark'] })
  @IsOptional()
  @IsString()
  curve?: 'ed25519' | 'secp256k1' | 'stark';

  @ApiPropertyOptional({ description: 'Key store id' })
  @IsOptional()
  @IsString()
  storeId?: string;
}

export class CustomCreateWalletDto {
  @ApiProperty({ description: 'Target network', example: 'Polygon' })
  @IsString()
  @MinLength(2)
  network!: string;

  @ApiPropertyOptional({ description: 'Wallet nickname' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: SigningKeyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SigningKeyDto)
  signingKey?: SigningKeyDto;

  @ApiPropertyOptional({ description: 'Delegate wallet to end user id' })
  @IsOptional()
  @IsString()
  delegateTo?: string;

  @ApiPropertyOptional({
    description: 'Create from service account, delegate later',
  })
  @IsOptional()
  @IsBoolean()
  delayDelegation?: boolean;

  @ApiPropertyOptional({ description: 'External correlation id' })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Validator id (Canton networks)' })
  @IsOptional()
  @IsString()
  validatorId?: string;

  @ApiPropertyOptional({
    description: "Override DSSC path (e.g., '/custody/wallets')",
    example: '/wallets',
  })
  @IsOptional()
  @IsString()
  httpPath?: string;

  @ApiPropertyOptional({
    description:
      'Optional DSSC end-user JWT. If provided and delegateTo is not set, the service will auto-delegate to the user in this token.',
  })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({
    description:
      'Optional org user id to tag the wallet creator (adds tag "creator:<id>").',
    example: 'us-xxxxxxxx',
  })
  @IsOptional()
  @IsString()
  createdByOrgUserId?: string;
}
