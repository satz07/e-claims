import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

class SendAssetMetaDto {
  @ApiProperty({ example: 'Erc20' })
  @IsString()
  @IsIn(['Native', 'Erc20'])
  kind: 'Native' | 'Erc20';

  @ApiProperty({ required: false, example: 'DDSC' })
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiProperty({
    required: false,
    example: '0x8E8e23483aA769D1C1A0540a39fA3c2466479586',
  })
  @IsOptional()
  @IsString()
  contract?: string;

  @ApiProperty({ required: false, example: 6 })
  @IsOptional()
  @IsString()
  decimals?: string;
}

class SendAssetPayloadDto {
  @ApiProperty({
    description: 'Sender wallet id',
    example: 'wa-REPLACE_WITH_WALLET_ID',
  })
  @IsString()
  senderwalletId: string;

  @ApiProperty({
    description: 'Destination address',
    example: 'destination address',
  })
  @IsString()
  destination: string;

  @ApiProperty({
    required: false,
    description: 'Human-readable amount (alias for humanAmount)',
    example: '',
  })
  @IsOptional()
  @IsString()
  Amount?: string;

  @ApiProperty({
    required: false,
    description: 'Human-readable amount',
    example: '1',
  })
  @IsOptional()
  @IsString()
  humanAmount?: string;

  @ApiProperty({
    required: false,
    description: 'Asset metadata for transfer',
  })
  @IsOptional()
  @IsObject()
  asset?: SendAssetMetaDto;
}

export class SendAssetDto {
  @ApiProperty({
    description: 'Payload forwarded to DSSC for transfer',
  })
  @IsObject()
  payload: SendAssetPayloadDto;
}
