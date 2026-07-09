import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DtpsActivateCardDto {
  @ApiProperty({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description: 'Selfie image in base64 format',
  })
  @IsString()
  @IsNotEmpty()
  selfieImg: string;

  @ApiProperty({
    example: '123',
    description: 'DTPS user card id',
  })
  @IsString()
  @IsNotEmpty()
  userCardId: string;
}
