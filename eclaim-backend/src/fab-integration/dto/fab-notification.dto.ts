import { IsString, IsOptional, IsIn, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FabNotificationHeaderDto {
  @ApiProperty({ description: 'Bearer token' })
  @IsString()
  Authorization: string;
}
// ====================
// Notification Request DTO
// ====================
export class FabNotificationRequestDto {
  @ApiProperty({ description: 'Channel ID', example: 'FAB' })
  @IsString()
  channelID: string;

  @ApiProperty({
    description: 'Channel transaction ID',
    example: 'Af860c31c88534153930451a4b7c4c24b',
  })
  @IsString()
  channelTransactionId: string;

  @ApiProperty({
    description: 'Debit customer name',
    example: 'FirstName MiddleName LastName',
  })
  @IsString()
  debitCustomerName: string;

  @ApiProperty({
    description: 'Credit customer name',
    example: 'FirstName MiddleName LastName',
  })
  @IsString()
  creditCustomerName: string;

  @ApiProperty({
    description: 'Debit account number',
    example: 'AE0650000101401234501',
  })
  @IsString()
  debitAccountNumber: string;

  @ApiProperty({
    description: 'Credit account number',
    example: '101111111121111',
  })
  @IsString()
  creditAccountNumber: string;

  @ApiProperty({
    description: 'Credit bank SWIFT',
    example: 'SW-ADCBAEA0',
    required: false,
  })
  @IsOptional()
  @IsString()
  creditBankSWIFT?: string;

  @ApiProperty({
    description: 'Transfer reference number',
    example: 'FT42434324',
  })
  @IsString()
  transferRefNo: string;

  @ApiProperty({ description: 'Debit currency code', example: 'USD' })
  @IsString()
  debitCurrency: string;

  @ApiProperty({ description: 'Credit currency code', example: 'USD' })
  @IsString()
  creditCurrency: string;

  @ApiProperty({ description: 'Debit amount', example: '-5000.00' })
  @IsString()
  debitAmount: string;

  @ApiProperty({ description: 'Credit amount', example: '', required: false })
  @IsOptional()
  @IsString()
  creditAmount?: string;

  @ApiProperty({
    description: 'Transaction description 1',
    example: 'Debit Transaction Details',
  })
  @IsString()
  transactionDesc1: string;

  @ApiProperty({
    description: 'Transaction description 2',
    example: 'Credit Transaction Details',
  })
  @IsString()
  transactionDesc2: string;

  @ApiProperty({
    description: 'Transaction description 3',
    example: 'Transaction additional Details',
  })
  @IsString()
  transactionDesc3: string;

  @ApiProperty({ description: 'Transaction type', example: 'OT' })
  @IsString()
  transactionType: string;

  @ApiProperty({
    description: 'Debit value date',
    example: '2024-05-01T23:51:58.792Z',
  })
  @IsDateString()
  debitValueDate: string;

  @ApiProperty({
    description: 'Credit value date',
    example: '2024-05-02T01:50:58.792Z',
  })
  @IsDateString()
  creditValueDate: string;

  @ApiProperty({
    description: 'Transaction datetime',
    example: '2024-05-02T01:51:58.792Z',
  })
  @IsDateString()
  transactionDateTime: string;

  @ApiProperty({
    description: 'Beneficiary our charges',
    enum: ['OUR', 'SHA', 'BEN'],
    example: 'SHA',
  })
  @IsString()
  @IsIn(['OUR', 'SHA', 'BEN'])
  benOurCharges: string;

  @ApiProperty({ description: 'Purpose of payment', example: 'FIS' })
  @IsString()
  purposeOfPayment: string;

  @ApiProperty({
    description: 'Charge amount',
    example: 'USD13.61',
    required: false,
  })
  @IsOptional()
  @IsString()
  chargeAmt?: string;

  @ApiProperty({
    description: 'Total charge amount',
    example: 'USD14.29',
    required: false,
  })
  @IsOptional()
  @IsString()
  totalChargeAmt?: string;

  @ApiProperty({
    description: 'Customer rate',
    example: '1.355',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerRate?: string;

  @ApiProperty({
    description: 'Request type',
    enum: ['NOTIFICATION', 'ALERT'],
    example: 'NOTIFICATION',
  })
  @IsString()
  @IsIn(['NOTIFICATION', 'ALERT'])
  requestType: string;

  @ApiProperty({ description: 'Error code', example: '', required: false })
  @IsOptional()
  @IsString()
  errorCode?: string;

  @ApiProperty({
    description: 'Error description',
    example: '',
    required: false,
  })
  @IsOptional()
  @IsString()
  errorDesc?: string;
}

// ====================
// Notification Response DTO
// ====================
export class FabNotificationResponseDto {
  @ApiProperty({
    description: 'Channel transaction ID',
    example: 'vdfre324ewfgeg',
  })
  channelTransactionId: string;

  @ApiProperty({
    description: 'Status of the notification',
    example: 'success',
  })
  status: string;

  @ApiProperty({ description: 'Error code', example: '0' })
  errorCode: string;
}
