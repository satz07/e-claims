import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMilestoneDto } from './milestone.dto';

export class CreateBeneficiaryDto {
  @ApiProperty({ example: 'John Doe Community' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ type: [CreateMilestoneDto], required: false })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateMilestoneDto)
  milestones?: CreateMilestoneDto[];
}

export class UpdateBeneficiaryDto extends PartialType(CreateBeneficiaryDto) {}
