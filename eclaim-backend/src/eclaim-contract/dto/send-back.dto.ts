import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SendBackDto {
  @ApiProperty({ description: 'Reason for sending the claim back' })
  @IsString()
  reason: string;
}
