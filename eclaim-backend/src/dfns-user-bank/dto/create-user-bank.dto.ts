// src/modules/user-bank/dto/create-user-bank.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateUserBankDto {
  @ApiProperty({ example: 'My Account' })
  @IsNotEmpty()
  @IsString()
  accountName: string;

  @ApiProperty({ example: 'AE070331234567890123456' })
  @IsNotEmpty()
  @IsString()
  iban: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    required: false,
  })
  documents?: any[];
}

// Admin can update status
export class UpdateBankStatusDto {
  @ApiProperty({
    example: 'Approved',
    enum: ['Pending', 'Approved', 'OnHold', 'Rejected'],
  })
  status: 'Pending' | 'Approved' | 'OnHold' | 'Rejected';

  @ApiProperty({ example: 'IBAN does not match documents', required: false })
  reason?: string;
}
