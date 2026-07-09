import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsPositive, IsString } from 'class-validator';

export enum TradeSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export class CryptoQuoteRequestDto {
  @ApiProperty({ enum: TradeSide, example: TradeSide.BUY })
  @IsEnum(TradeSide)
  side: TradeSide;

  @ApiProperty({ example: 'BTC' })
  @IsString()
  assetSymbol: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @IsPositive()
  amount: number;
}

export class CryptoQuoteResponseDto {
  @ApiProperty({ example: 'BUY' })
  side: string;

  @ApiProperty({ example: 'BTC' })
  symbol: string;

  @ApiProperty({ example: 'Bitcoin' })
  name: string;

  @ApiProperty({ example: 100 })
  amount: number;

  @ApiProperty({ example: 68450.12 })
  liveUnitPriceUsd: number;

  @ApiProperty({ example: 6845012 })
  quoteAmountUsd: number;

  @ApiProperty({ example: 'DDSC' })
  settlementSymbol: string;

  @ApiProperty({ example: 100 })
  settlementAmount: number;

  @ApiProperty({ example: 'SUCCESS' })
  status: string;

  @ApiProperty({
    example: 'BUY validated and DDSC settlement completed successfully',
  })
  message: string;

  @ApiProperty({ example: '2026-03-25T06:10:00.000Z' })
  marketTimestamp: string;
}
