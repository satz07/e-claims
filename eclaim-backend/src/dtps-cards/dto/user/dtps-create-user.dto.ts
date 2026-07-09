import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsString, Matches, Min } from 'class-validator';

export class DtpsCreateUserDto {
  @ApiProperty({ example: 'AE' })
  @IsString()
  @Matches(/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/, {
    message: 'birth_country must be ISO 3166-2 format (e.g. AE or AE-DU)',
  })
  birth_country: string;

  @ApiProperty({ example: 'Dubai' })
  @IsString()
  district: string;

  @ApiProperty({ example: '20/01/1990' })
  @IsString()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'dob must be in DD/MM/YYYY format',
  })
  dob: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  first_name: string;

  @ApiProperty({ example: 'Male' })
  @IsString()
  gender: string;

  @ApiProperty({ example: 971 })
  @IsInt()
  @Min(0)
  isd_code: number;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  last_name: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  mail: string;

  @ApiProperty({ example: 'Engineer' })
  @IsString()
  occupation: string;

  @ApiProperty({ example: '31/12/2030' })
  @IsString()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'passport_expiry_date must be in DD/MM/YYYY format',
  })
  passport_expiry_date: string;

  @ApiProperty({ example: '01/01/2020' })
  @IsString()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'passport_issue_date must be in DD/MM/YYYY format',
  })
  passport_issue_date: string;

  @ApiProperty({ example: 'A12345678' })
  @IsString()
  passportnumber: string;

  @ApiProperty({ example: 'Dubai' })
  @IsString()
  place_of_birth: string;

  @ApiProperty({ example: 'Dubai' })
  @IsString()
  province: string;

  @ApiProperty({ example: '501234567' })
  @IsString()
  telephone: string;

  @ApiProperty({ example: 'Mr' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Al Barsha' })
  @IsString()
  village: string;
}
