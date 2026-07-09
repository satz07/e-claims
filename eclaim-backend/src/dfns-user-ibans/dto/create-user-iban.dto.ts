import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUserIbanDto {
  @ApiProperty({
    description: 'Account holder name',
    example: 'Saqib Altaf',
  })
  @IsNotEmpty()
  @IsString()
  accountName: string;

  @ApiProperty({
    description: 'Wallet address linked with this IBAN',
    example: '0xA1B2C3D4E5F678901234567890abcdef12345678',
  })
  @IsNotEmpty()
  @IsString()
  walletAddress: string;

  @ApiPropertyOptional({
    description: 'Optional nickname for this IBAN',
    example: 'Primary Bank Account',
  })
  @IsOptional()
  @IsString()
  nickname?: string;
}
