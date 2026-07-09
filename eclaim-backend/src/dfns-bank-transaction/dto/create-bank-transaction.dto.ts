// dto/create-bank-transaction.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  Min,
  IsString,
  IsEnum,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import {
  BankTransactionStatus,
  BankTransactionType,
} from 'src/database/entities/bank-transaction.entity';

export class CreateBankTransactionDto {
  @ApiProperty({
    description: 'Transaction type (DEPOSIT, WITHDRAW)',
    enum: BankTransactionType,
    example: BankTransactionType.DEPOSIT,
  })
  @IsEnum(BankTransactionType)
  transactionType: BankTransactionType;

  @ApiProperty({ description: 'Amount in AED', example: 201000 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Reference ID (required only for DEPOSIT)',
    example: 'REF-123456',
    required: false,
  })
  @ValidateIf((o) => o.transactionType === BankTransactionType.DEPOSIT)
  @IsNotEmpty()
  @IsString()
  referenceId?: string;

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
export class UpdateBankTransactionStatusDto {
  @ApiProperty({
    example: 'Approved (Pending, Approved, OnHold, Rejected)',
    enum: ['Pending', 'Approved', 'OnHold', 'Rejected'],
  })
  @IsEnum(BankTransactionStatus)
  status: BankTransactionStatus;

  @ApiProperty({ example: 'IBAN does not match documents', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
