// src/modules/kyc/dto/get-status.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class GetKycStatusQueryDto {
  @ApiProperty({ example: 'user@example.com' })
  email: string;
}

export class KycStatusResponseDto {
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({
    example: 'Pending',
    enum: [
      'Init',
      'Incomplete',
      'Pending',
      'Approved',
      'Rejected',
      'FinallyRejected',
    ],
  })
  reviewStatus: string;

  @ApiProperty({ example: 'BASIC', nullable: true })
  levelName?: string | null;

  @ApiProperty({
    example: '70f0a4d2-8f77-4a4a-8b8d-8a8a8a8a8a8a',
    nullable: true,
  })
  applicantId: string | null;

  @ApiProperty({
    example: 'b3fdd4a9-6a8c-4a80-a02a-31b6e0f7b8b9',
    nullable: true,
  })
  id: number | null;

  @ApiProperty({ example: '2025-10-31T18:20:00.000Z', nullable: true })
  updatedAt: Date | null;
}

export class ReviewResultDto {
  @ApiProperty({ enum: ['GREEN', 'RED'], example: 'GREEN' })
  @IsEnum(['GREEN', 'RED'] as const)
  reviewAnswer!: 'GREEN' | 'RED';
}

export enum SumsubEventType {
  ApplicantCreated = 'applicantCreated',
  ApplicantReviewed = 'applicantReviewed',
  ApplicantFinallyRejected = 'applicantFinallyRejected',
  ApplicantPending = 'applicantPending',
  ApplicantOnHold = 'applicantOnHold',
  ApplicantActionRequired = 'applicantActionRequired',
}

export class SumsubWebhookDto {
  @ApiProperty({ enum: SumsubEventType })
  type: SumsubEventType;

  @ApiPropertyOptional({ example: '64f7f2a9f3f9bd2f1e7c5a01' })
  applicantId?: string;

  // CRITICAL: Sumsub sends the 'externalUserId' you used when minting the SDK token
  @ApiPropertyOptional({ example: 'b3fdd4a9-6a8c-4a80-a02a-31b6e0f7b8b9' })
  externalUserId?: string;

  @ApiPropertyOptional({
    example: 'completed',
    description: 'Sumsub review phase',
  })
  reviewStatus?: string;

  @ApiPropertyOptional({
    example: { reviewAnswer: 'GREEN', moderationComment: 'OK' },
    description: 'Raw review result from Sumsub',
  })
  reviewResult?: {
    reviewAnswer?: 'GREEN' | 'RED' | 'YELLOW';
    [k: string]: any;
  };

  [k: string]: any;
}
