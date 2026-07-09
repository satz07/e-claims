import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DtpsActivateReplacementCardDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Card holder name',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '1234567890123456',
    description: 'New card number',
  })
  @IsString()
  @IsNotEmpty()
  newCardNumber: string;

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
