import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DtpsCardTxnHistoryQueryDto {
  @ApiProperty({
    example: '2026-01-31',
    description: 'Start date',
  })
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    example: '2026-03-31',
    description: 'End date',
  })
  @IsString()
  @IsNotEmpty()
  endDate: string;
}
