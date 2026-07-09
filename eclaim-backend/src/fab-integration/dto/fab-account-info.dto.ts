import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class FabAccountInfoHeaderDto {
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

export class FabAccountInfoRequestDto {
  @ApiProperty({
    description:
      'Base64 encrypted payload containing { customerIdentifier, accountIdentifier }',
  })
  @IsString()
  messagePayload: string;

  @ApiProperty({
    description: 'Customer Identifier Number, unique for AEDC client',
  })
  @IsString()
  customerIdentifier: string;

  @ApiProperty({ description: 'Account Number' })
  @IsString()
  accountIdentifier: string;
}

export class FabAccountInfoResponseDto {
  @ApiProperty({
    description: 'Base64 encrypted response payload',
  })
  @IsString()
  messagePayload: string;
}
