import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import {
  OpportunitySector,
  PriorityLevel,
  OpportunityApprovalStatus,
} from '../../database/entities/enums';

export class ListCampaignsQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({ enum: OpportunityApprovalStatus, required: false })
  @IsOptional()
  @IsEnum(OpportunityApprovalStatus)
  status?: OpportunityApprovalStatus;

  @ApiProperty({ enum: OpportunitySector, required: false })
  @IsOptional()
  @IsEnum(OpportunitySector)
  sector?: OpportunitySector;

  @ApiProperty({ enum: PriorityLevel, required: false })
  @IsOptional()
  @IsEnum(PriorityLevel)
  priority?: PriorityLevel;
}
