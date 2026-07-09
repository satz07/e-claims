import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';

export class DfnsCredentialInfoDto {
  @ApiProperty()
  @IsString()
  credId!: string;

  @ApiProperty()
  @IsString()
  clientData!: string;

  @ApiProperty()
  @IsString()
  attestationData!: string;
}

export class DfnsCredentialDto {
  @ApiProperty({ example: 'Fido2' })
  @IsString()
  credentialKind!: 'Fido2' | 'RecoveryKey';

  @ApiProperty({ type: DfnsCredentialInfoDto })
  @IsObject()
  credentialInfo!: DfnsCredentialInfoDto;

  @ApiProperty()
  @IsString()
  credentialName!: string;
}

export class CreateEndUserWalletDto {
  @ApiProperty({ example: 'Algorand' })
  @IsString()
  network!: string;

  @ApiProperty({ example: 'Primary Wallet' })
  @IsString()
  name!: string;
}
