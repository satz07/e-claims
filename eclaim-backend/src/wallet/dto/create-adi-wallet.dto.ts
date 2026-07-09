import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAdiWalletDto {
  @ApiPropertyOptional({ description: 'Wallet AdiTestnet' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({
    description: "Optional DSSC path override (e.g., '/custody/wallets')",
    example: '/wallets',
  })
  @IsOptional()
  @IsString()
  httpPath?: string;

  @ApiPropertyOptional({
    description:
      'DSSC user id to delegate the wallet to (accepts us-/eu-/en- depending on tenant).',
    example: 'us-xxxxxxxx',
  })
  @IsOptional()
  @IsString()
  delegateTo?: string;

  @ApiPropertyOptional({
    description:
      'DSSC user JWT. If provided and delegateTo is not set, the service will auto-delegate to the user in this token.',
  })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({
    description:
      'Optional org user id to tag the wallet creator (adds tag "creator:<id>").',
    example: 'us-xxxxxxxx',
  })
  @IsOptional()
  @IsString()
  createdByOrgUserId?: string;
}
