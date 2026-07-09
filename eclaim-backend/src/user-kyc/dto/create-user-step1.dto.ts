// dto/create-user-step1.dto.ts
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserStep1Dto {
  @ApiProperty({
    description: 'Email address of the user',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Phone number of the user',
    example: '0501234567',
  })
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;
}
