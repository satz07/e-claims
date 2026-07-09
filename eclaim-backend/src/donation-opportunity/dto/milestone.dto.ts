import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  IsDateString,
  IsEnum,
  IsOptional,
  Max,
} from 'class-validator';
import { MilestoneStatus } from '../../database/entities/milestone.entity';

export class CreateMilestoneDto {
  @ApiProperty({ example: 'Initial Site Survey' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ example: '2024-05-01' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2024-05-15' })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 5000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    example: 'Survey the land for well digging.',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: [1, 2],
    required: false,
    description: 'Pre-uploaded attachment IDs',
  })
  @IsOptional()
  @IsNumber({}, { each: true })
  attachmentIds?: number[];
}

export class UpdateMilestoneDto extends PartialType(CreateMilestoneDto) {
  @ApiProperty({ example: 50, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiProperty({ enum: MilestoneStatus, required: false })
  @IsOptional()
  @IsEnum(MilestoneStatus)
  status?: MilestoneStatus;
}
