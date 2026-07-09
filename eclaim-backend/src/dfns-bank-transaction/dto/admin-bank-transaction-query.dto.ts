// dto/admin-bank-transaction-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, Min, IsPositive, IsEnum } from 'class-validator';

export enum UserTypeFilter {
  All = 'All',
  Individual = 'Individual',
  Business = 'Business',
}

export enum BankTransactionStatusFilter {
  All = 'All',
  Pending = 'Pending',
  Approved = 'Approved',
  OnHold = 'On Hold',
  Rejected = 'Rejected',
}

export class AdminBankTransactionQueryDto {
  @ApiPropertyOptional({ enum: UserTypeFilter, example: UserTypeFilter.All })
  @IsOptional()
  @IsEnum(UserTypeFilter)
  userType?: UserTypeFilter = UserTypeFilter.All;

  @ApiPropertyOptional({
    enum: BankTransactionStatusFilter,
    example: BankTransactionStatusFilter.All,
  })
  @IsOptional()
  @IsEnum(BankTransactionStatusFilter)
  status?: BankTransactionStatusFilter = BankTransactionStatusFilter.All;

  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  limit?: number = 10;
}
