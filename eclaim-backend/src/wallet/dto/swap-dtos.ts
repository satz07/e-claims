import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class NativeSourceAssetDto {
  @ApiProperty({ enum: ['Native'] })
  @IsIn(['Native'])
  kind!: 'Native';

  @ApiProperty({ description: 'Amount in smallest unit (wei, etc.)' })
  @IsString()
  amount!: string;
}

export class Erc20SourceAssetDto {
  @ApiProperty({ enum: ['Erc20'] })
  @IsIn(['Erc20'])
  kind!: 'Erc20';

  @ApiProperty({ description: 'ERC20 contract address' })
  @IsString()
  contract!: string;

  @ApiProperty({ description: 'Amount in smallest unit' })
  @IsString()
  amount!: string;
}

export class NativeTargetAssetDto {
  @ApiProperty({ enum: ['Native'] })
  @IsIn(['Native'])
  kind!: 'Native';
}

export class Erc20TargetAssetDto {
  @ApiProperty({ enum: ['Erc20'] })
  @IsIn(['Erc20'])
  kind!: 'Erc20';

  @ApiProperty({ description: 'ERC20 contract address' })
  @IsString()
  contract!: string;
}

export class CreateSwapQuoteDto {
  @ApiProperty({ enum: ['UniswapX', 'UniswapClassic'] })
  @IsIn(['UniswapX', 'UniswapClassic'])
  provider!: 'UniswapX' | 'UniswapClassic';

  @ApiProperty({ description: 'DSSC wallet id spending sourceAsset' })
  @IsString()
  walletId!: string;

  @ApiProperty({
    required: false,
    description: 'Must equal walletId if provided',
  })
  @IsOptional()
  @IsString()
  targetWalletId?: string;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(NativeSourceAssetDto) },
      { $ref: getSchemaPath(Erc20SourceAssetDto) },
    ],
  })
  @ValidateNested()
  @Type(() => Object)
  @IsObject()
  sourceAsset!: NativeSourceAssetDto | Erc20SourceAssetDto;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(NativeTargetAssetDto) },
      { $ref: getSchemaPath(Erc20TargetAssetDto) },
    ],
  })
  @ValidateNested()
  @Type(() => Object)
  @IsObject()
  targetAsset!: NativeTargetAssetDto | Erc20TargetAssetDto;

  @ApiProperty({ description: 'Slippage in basis points (BPS)' })
  @IsNumber()
  slippageBps!: number;
}

export class CreateSwapDto {
  @ApiProperty({ description: 'Quote id returned by /swaps/quotes' })
  @IsString()
  quoteId!: string;

  @ApiProperty({ enum: ['UniswapX', 'UniswapClassic'] })
  @IsIn(['UniswapX', 'UniswapClassic'])
  provider!: 'UniswapX' | 'UniswapClassic';

  @ApiProperty({ description: 'DSSC wallet id spending sourceAsset' })
  @IsString()
  walletId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  targetWalletId?: string;

  @ApiProperty({ description: 'Slippage in basis points (BPS)' })
  @IsNumber()
  slippageBps!: number;

  @ApiProperty({
    oneOf: [
      { $ref: NativeSourceAssetDto.name },
      { $ref: Erc20SourceAssetDto.name },
    ],
  })
  @ValidateNested()
  @Type(() => Object)
  @IsObject()
  sourceAsset!: NativeSourceAssetDto | Erc20SourceAssetDto;

  @ApiProperty({
    oneOf: [
      { $ref: NativeTargetAssetDto.name },
      { $ref: Erc20TargetAssetDto.name },
    ],
  })
  @ValidateNested()
  @Type(() => Object)
  @IsObject()
  targetAsset!: NativeTargetAssetDto | Erc20TargetAssetDto;
}
