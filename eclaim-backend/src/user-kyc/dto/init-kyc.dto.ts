// src/modules/kyc/dto/init-kyc.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsBoolean } from 'class-validator';

export class InitKycDto {
  // Common field: type of applicant
  @ApiProperty({ example: 'KYC' }) // or 'KYB'
  @IsString()
  type: 'KYC' | 'KYB';

  // Personal user info (KYC)
  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  // Common
  @ApiPropertyOptional({ example: 'ADI-level' })
  @IsOptional()
  @IsString()
  levelName?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
