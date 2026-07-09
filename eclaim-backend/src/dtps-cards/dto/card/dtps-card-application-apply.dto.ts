import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DtpsCardApplicationApplyDto {
  @ApiProperty({ example: '1234567890' })
  @IsString()
  accountNumber: string;

  @ApiProperty({ example: 'card-id-123' })
  @IsString()
  cardId: string;

  @ApiProperty({ example: '4111111111111111' })
  @IsString()
  cardNumber: string;

  @ApiProperty({
    example: 'Apartment 304, ABC Tower, Street 12, Al Barsha, Dubai, UAE',
    description: 'Full UAE delivery address',
  })
  @IsString()
  carddeliveryaddress: string;

  @ApiProperty({ example: 'JOHN DOE' })
  @IsString()
  embossname: string;
}
