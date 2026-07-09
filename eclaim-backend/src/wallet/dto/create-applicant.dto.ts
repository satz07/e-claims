// src/modules/kyc/dto/link-applicant.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LinkApplicantDto {
  @ApiProperty({ example: 'appl_1234567890' })
  @IsString()
  applicantId!: string;
}

export class LinkApplicantResponseDto {
  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'appl_1234567890' })
  applicantId!: string;

  @ApiProperty({
    example: 'Init',
    enum: [
      'Init',
      'Incomplete',
      'Pending',
      'Approved',
      'Rejected',
      'FinallyRejected',
    ],
  })
  reviewStatus!: string;

  @ApiProperty({ example: 'ADI-level', nullable: true })
  levelName?: string;

  @ApiProperty({ example: 'f2a7c8b2-...', nullable: true })
  id?: string;
}
