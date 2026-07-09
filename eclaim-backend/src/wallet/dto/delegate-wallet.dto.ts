import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DelegateWalletDto {
  @ApiProperty({
    description: 'DSSC End User id to delegate to',
    example: 'us-xxxxxxxx',
  })
  @IsString()
  @MinLength(3)
  userId!: string;
}
