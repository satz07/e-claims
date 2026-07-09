import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  IsDateString,
  IsIn,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  OpportunitySector,
  PriorityLevel,
  OpportunityApprovalStatus,
} from '../../database/entities/enums';

export class CreateOpportunityDto {
  @ApiProperty({ example: 'Clean Water Initiative' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ example: 'Providing clean water to 1000 people.' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ example: 50000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  targetAmount: number;

  @ApiProperty({ enum: OpportunitySector, example: OpportunitySector.HEALTH })
  @IsNotEmpty()
  @IsEnum(OpportunitySector)
  sector: OpportunitySector;

  @ApiProperty({
    enum: PriorityLevel,
    example: PriorityLevel.MEDIUM,
    required: false,
  })
  @IsOptional()
  @IsEnum(PriorityLevel)
  priorityLevel?: PriorityLevel;

  @ApiProperty({ example: '2024-05-01' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2024-12-31' })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: '1000 people get clean water' })
  @IsNotEmpty()
  @IsString()
  targetOutcome: string;

  @ApiProperty({ example: 'Villagers in Region X', required: false })
  @IsOptional()
  @IsString()
  expectedBeneficiaries?: string;

  @ApiProperty({ example: 123, required: false })
  @IsOptional()
  @IsNumber()
  implementationPartnerId?: number;

  @ApiProperty({ example: 1, description: 'ID of the associated campaign' })
  @IsNotEmpty()
  @IsNumber()
  campaignId: number;

  @ApiProperty({
    example: 101,
    required: false,
    description: 'Pre-uploaded banner attachment ID',
  })
  @IsOptional()
  @IsNumber()
  bannerId?: number;
}

export class UpdateOpportunityDto extends PartialType(CreateOpportunityDto) {}

export class CreateProjectPlanDto {
  @ApiProperty({ example: '2024-05-01' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2024-12-31' })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 'Successfully build 5 wells' })
  @IsNotEmpty()
  @IsString()
  targetOutcome: string;

  @ApiProperty({ example: 'Villagers in Region X', required: false })
  @IsOptional()
  @IsString()
  expectedBeneficiaries?: string;

  @ApiProperty({
    example: 'Detailed brief of the operational plan...',
    required: false,
  })
  @IsOptional()
  @IsString()
  brief?: string;

  @ApiProperty({
    example: [1, 2],
    required: false,
    description: 'Pre-uploaded attachment IDs',
  })
  @IsOptional()
  @IsNumber({}, { each: true })
  attachmentIds?: number[];
}

export class UpdateProjectPlanDto extends PartialType(CreateProjectPlanDto) {}

export class ListOpportunitiesQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false })
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;
}

const AdminStatusChanges = [
  OpportunityApprovalStatus.APPROVED,
  OpportunityApprovalStatus.REJECTED,
  OpportunityApprovalStatus.ON_HOLD,
  OpportunityApprovalStatus.RETURNED,
];

export class UpdateOpportunityStatusDto {
  @ApiProperty({ enum: AdminStatusChanges })
  @IsNotEmpty()
  @IsIn(AdminStatusChanges)
  status: OpportunityApprovalStatus;

  @ApiProperty({
    example: 'Needs more clear target outcomes.',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
