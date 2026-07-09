import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ProofDocumentDto {
  @ApiProperty({ example: 'https://storage.example.com/proof/doc1.pdf' })
  @IsString()
  url: string;

  @ApiProperty({ example: 'Milestone completion certificate' })
  @IsString()
  label: string;
}

export class SubmitProofDto {
  @ApiProperty({
    description: 'List of proof documents for milestone completion',
    type: [ProofDocumentDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProofDocumentDto)
  documents: ProofDocumentDto[];
}

export class RejectProofDto {
  @ApiProperty({
    example:
      'Documents are incomplete. Please resubmit with signed certificate.',
  })
  @IsString()
  reason: string;
}
