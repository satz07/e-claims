// dto/pagination.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsPositive, Min, IsEnum } from 'class-validator';
import { BankTransactionType } from 'src/database/entities/bank-transaction.entity';

export class PaginationDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number, starts from 1',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Items per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  limit?: number = 10;

  @ApiPropertyOptional({
    enum: BankTransactionType,
    description: 'Filter by transaction type (DEPOSIT, WITHDRAW)',
    example: BankTransactionType.DEPOSIT,
  })
  @IsOptional()
  @IsEnum(BankTransactionType)
  transactionType?: BankTransactionType;
}
