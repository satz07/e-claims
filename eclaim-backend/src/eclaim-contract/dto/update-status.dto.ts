import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateStatusDto {
  @ApiProperty({ description: 'New status of the claim' })
  @IsNumber()
  status: number;

  @ApiProperty({ description: 'Approved total amount', required: false })
  @IsOptional()
  @IsNumber()
  approvedTotal?: number;
}
