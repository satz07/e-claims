// src/modules/user-bank/dto/admin-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsPositive, Min } from 'class-validator';

export enum UserTypeFilter {
  Individual = 'Individual',
  Business = 'Business',
  All = 'All',
}

export enum BankStatusFilter {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
  OnHold = 'OnHold',
  All = 'All',
}

export class AdminBankQueryDto {
  @ApiPropertyOptional({ enum: UserTypeFilter, default: UserTypeFilter.All })
  @IsOptional()
  @IsEnum(UserTypeFilter)
  userType?: UserTypeFilter = UserTypeFilter.All;

  @ApiPropertyOptional({
    enum: BankStatusFilter,
    default: BankStatusFilter.All,
  })
  @IsOptional()
  @IsEnum(BankStatusFilter)
  status?: BankStatusFilter = BankStatusFilter.All;

  @ApiPropertyOptional({
    example: 1,
    description: 'Page number, starts from 1',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  limit?: number = 10;
}
