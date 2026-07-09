import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class DonateRequestPayloadDto {
  @ApiProperty({
    description: 'Opportunity ID to link to this donation',
    example: '123',
  })
  @IsString()
  opportunityId: string;

  @ApiProperty({
    required: false,
    description: 'Human-readable amount (alias for humanAmount)',
    example: '',
  })
  @IsOptional()
  @IsString()
  Amount?: string;

  @ApiProperty({
    required: false,
    description: 'Human-readable token amount e.g. "1" for 1 DDSC',
    example: '1',
  })
  @IsOptional()
  @IsString()
  humanAmount?: string;
}

export class DonateRequestDto {
  @ApiProperty({
    description: 'Payload for the donation request',
  })
  @IsObject()
  payload: DonateRequestPayloadDto;
}
