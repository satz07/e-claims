import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListWalletsDto {
  @ApiPropertyOptional({
    description: 'DFNS end-user JWT',
  })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({
    description: 'DFNS end-user id (us-...)',
    example: 'us-xxxxxxxx',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
