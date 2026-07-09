// dto/create-user-step2.dto.ts
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserStep2Dto {
  @ApiProperty({
    description: 'Email address of the user (must match Step 1)',
    example: 'user@example.com',
  })
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({
    description: 'Select the account type',
    enum: ['Individual', 'Business'],
    example: 'Individual',
  })
  @IsIn(['Individual', 'Business'])
  accountType: 'Individual' | 'Business';
}
