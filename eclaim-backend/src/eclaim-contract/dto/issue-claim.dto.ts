import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsIn,
} from 'class-validator';

export class IssueClaimDto {
  @ApiProperty({ description: 'Address of the recipient' })
  @IsString()
  to: string;

  @ApiProperty({ description: 'Unique claim ID' })
  @IsString()
  claimId: string;

  @ApiProperty({
    description: 'Type of claim',
    enum: [
      'surgical',
      'approved',
      'declined',
      'maternity-inpatient',
      'patient',
      'rejected',
      'resubmitted',
      'sent-back',
    ],
  })
  @IsString()
  @IsIn([
    'surgical',
    'approved',
    'declined',
    'maternity-inpatient',
    'patient',
    'rejected',
    'resubmitted',
    'sent-back',
  ])
  claimType: string;

  @ApiProperty({ description: 'Medical record or claim data' })
  record: any;

  @ApiProperty({ description: 'Total claimed amount' })
  @IsNumber()
  claimedTotal: number;

  @ApiProperty({ description: 'Claim validity start date (timestamp)' })
  @IsNumber()
  dateFrom: number;

  @ApiProperty({ description: 'Claim validity end date (timestamp)' })
  @IsNumber()
  dateTo: number;

  @ApiProperty({ description: 'Burn authorization flag', required: false })
  @IsOptional()
  @IsBoolean()
  burnAuth?: boolean;
}
