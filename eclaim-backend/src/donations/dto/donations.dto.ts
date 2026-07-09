import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsString,
  IsEnum,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DonationPaymentSource,
  DonationStep,
} from '../../database/entities/donation.enums';

// ================================================================
// Query / List
// ================================================================

export class ListDonationsQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  campaignId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  opportunityId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  beneficiaryId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  milestoneId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  donorId?: number;

  @ApiProperty({ enum: DonationStep, required: false })
  @IsOptional()
  @IsEnum(DonationStep)
  donationStep?: DonationStep;

  @ApiProperty({ enum: DonationPaymentSource, required: false })
  @IsOptional()
  @IsEnum(DonationPaymentSource)
  paymentSource?: DonationPaymentSource;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;
}

export class MyDonatedOpportunitiesQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;
}

// ================================================================
// Create
// ================================================================

export class CreateDonationDto {
  @ApiProperty({ description: 'Campaign ID', required: false })
  @IsOptional()
  @IsNumber()
  campaignId?: number;

  @ApiProperty({ description: 'Donation Opportunity ID' })
  @IsNumber()
  opportunityId: number;

  @ApiProperty({ description: 'Beneficiary ID', required: false })
  @IsOptional()
  @IsNumber()
  beneficiaryId?: number;

  @ApiProperty({ description: 'Milestone ID', required: false })
  @IsOptional()
  @IsNumber()
  milestoneId?: number;

  @ApiProperty({
    description: 'Amount in minor currency units (e.g. cents)',
    example: '100000',
  })
  @IsString()
  amountMinor: string;

  @ApiProperty({ description: 'ISO currency code', example: 'AED' })
  @IsString()
  currency: string;

  @ApiProperty({ enum: DonationPaymentSource, description: 'WALLET or FIAT' })
  @IsEnum(DonationPaymentSource)
  paymentSource: DonationPaymentSource;

  @ApiProperty({
    required: false,
    description: 'Donor wallet ID (required for WALLET flow)',
  })
  @IsOptional()
  @IsString()
  walletId?: string;

  @ApiProperty({ required: false, description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
