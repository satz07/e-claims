import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CheckDuplicateDto {
  @ApiProperty({
    example: 'KEN-9301',
    description: 'Unique claim identifier',
  })
  @IsString()
  @IsNotEmpty()
  claimId: string;

  @ApiProperty({
    example: 'invoice',
    description: 'Type of file associated with the claim',
  })
  @IsString()
  @IsNotEmpty()
  fileType: string;
}
