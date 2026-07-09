import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsNotEmpty,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class FabTransferHeaderDto {
  @ApiProperty({ description: 'Bearer token' })
  @IsString()
  Authorization: string;

  @ApiProperty({ description: 'Unique channel id' })
  @IsString()
  CHANNELID: string;

  @ApiProperty({ description: 'Transaction datetime' })
  @IsString()
  TRANSACTIONDATETIME: string;

  @ApiProperty({ description: 'Correlation id (40 char)' })
  @IsString()
  TRANSACTIONID: string;
}

// ====================
// Beneficiary DTO
// ====================
export class BeneficiaryDto {
  @ApiProperty({ description: 'Name of the Beneficiary', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  beneName: string;

  @ApiProperty({ description: 'Address of the Beneficiary', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  beneAddress: string;

  @ApiProperty({ description: 'City of the Beneficiary', maxLength: 35 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(35)
  beneCity: string;

  @ApiProperty({ description: 'Beneficiary account number', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  beneBankAccount: string;

  @ApiProperty({ description: 'Currency of beneficiary account', maxLength: 3 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  beneCurrency: string;

  @ApiProperty({
    description: 'SWIFT code of beneficiary bank',
    maxLength: 50,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  beneBankSWIFTCode?: string;

  @ApiProperty({
    description: 'Routing code of beneficiary bank',
    maxLength: 50,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  beneBankRoutingCode?: string;

  @ApiProperty({ description: 'Name of beneficiary bank', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  beneBankName: string;

  @ApiProperty({ description: 'Address of beneficiary bank', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  beneBankAddress: string;

  @ApiProperty({ description: 'City of beneficiary bank', maxLength: 35 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(35)
  beneBankCity: string;

  @ApiProperty({ description: 'Country of beneficiary bank', maxLength: 3 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  beneBankCountry: string;
}

// ====================
// Ordering Customer DTO
// ====================
export class OrderingCustomerDto {
  @ApiProperty({ description: 'Sender account number', maxLength: 16 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  accountNumber: string;

  @ApiProperty({ description: 'Sender name', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: 'Sender address line 1', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  addressLine1: string;

  @ApiProperty({
    description: 'Sender address line 2',
    maxLength: 100,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  addressLine2?: string;
}

// ====================
// Transfer Request DTO
// ====================
export class TransferRequestDto {
  @ApiProperty({
    description: 'Encrypted message payload (base64 encoded AES/GCM)',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  messagePayload: string;

  @ApiProperty({ description: 'Hashed customer identifier (CIN)' })
  @IsString()
  @IsNotEmpty()
  customerIdentifier: string;

  @ApiProperty({ description: 'Debit account number', maxLength: 16 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  debitAccountNo: string;

  @ApiProperty({
    description: 'Credit account number (optional)',
    maxLength: 16,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(16)
  creditAccountNo?: string;

  @ApiProperty({
    description: 'Transaction amount (>= 1)',
    type: Number,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  transactionAmount: number;

  @ApiProperty({ description: 'Debit account currency code', maxLength: 3 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  debitAccountCurrency: string;

  @ApiProperty({ description: 'Transaction currency code', maxLength: 3 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  transactionCurrency: string;

  @ApiProperty({ description: 'Payment details / remarks', maxLength: 140 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  paymentDetails: string;

  @ApiProperty({
    description: 'Charge bearer type',
    enum: ['OUR', 'SHA', 'BEN'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['OUR', 'SHA', 'BEN'])
  chargeBearerIndicationType: string;

  @ApiProperty({ description: 'Transfer type', enum: ['SWIFT', 'UAE', 'BNK'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['SWIFT', 'UAE', 'BNK'])
  transferType: string;

  @ApiProperty({
    description: 'Created by user ID (optional)',
    maxLength: 20,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  createdBy?: string;

  @ApiProperty({
    description: 'Beneficiary details',
    type: () => BeneficiaryDto,
  })
  @ValidateNested()
  @Type(() => BeneficiaryDto)
  beneficiary: BeneficiaryDto;

  @ApiProperty({
    description: 'Ordering customer details',
    type: () => OrderingCustomerDto,
  })
  @ValidateNested()
  @Type(() => OrderingCustomerDto)
  orderingCustomer: OrderingCustomerDto;

  @ApiProperty({ description: 'Purpose of payment', maxLength: 3 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  purposeOfPayment: string;
}
