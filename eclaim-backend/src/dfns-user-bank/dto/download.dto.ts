// src/modules/user-bank/dto/admin-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

// Define allowed user types
export enum UserTypeDTO {
  Individual = 'Individual',
  Business = 'Business',
}

// Define allowed bank statuses
export enum BankStatusDTO {
  Pending = 'Pending',
  Approved = 'Approved',
  OnHold = 'OnHold',
  Rejected = 'Rejected',
}

// ✅ Download type
export enum DownloadTypeDTO {
  CSV = 'csv',
  PDF = 'pdf',
}

export class AdminDownloadQueryDto {
  @ApiPropertyOptional({
    enum: UserTypeDTO,
    description: 'Filter by user type',
  })
  @IsOptional()
  @IsEnum(UserTypeDTO)
  userType?: UserTypeDTO;

  @ApiPropertyOptional({
    enum: BankStatusDTO,
    description: 'Filter by bank status',
  })
  @IsOptional()
  @IsEnum(BankStatusDTO)
  status?: BankStatusDTO;

  // ✅ new field
  @ApiPropertyOptional({
    enum: DownloadTypeDTO,
    description: 'Download file type (csv or pdf)',
    default: DownloadTypeDTO.CSV,
  })
  @IsOptional()
  @IsEnum(DownloadTypeDTO)
  downloadType?: DownloadTypeDTO;
}
