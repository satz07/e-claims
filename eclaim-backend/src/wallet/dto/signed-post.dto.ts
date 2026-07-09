import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class SignedPostDto {
  @ApiProperty({
    description: 'Payload forwarded to DSSC as-is for this action.',
  })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiProperty({
    required: false,
    description:
      "Optional DSSC API path override (e.g., '/custody/transactions').",
  })
  @IsOptional()
  @IsString()
  httpPath?: string;
}
