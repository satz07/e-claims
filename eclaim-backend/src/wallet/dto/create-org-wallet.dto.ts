import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateOrgWalletDto {
  @ApiProperty({
    description: 'DFNS network name (e.g., AdiTestnet, EthereumSepolia)',
    example: '',
  })
  @IsString()
  network: string;

  @ApiProperty({
    description: 'Wallet display name',
    example: '',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'User ID for whom the wallet is being created',
    example: '62330871-5bda-4966-9549-31568a3eb2d4',
  })
  @IsString()
  userId: number;
}
