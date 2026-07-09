import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDfnsUserDto {
  @ApiProperty({
    description: 'User email address (must be valid).',
    example: 'jane.doe@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Unique username (max 64 chars).',
    maxLength: 64,
    example: 'jane_doe',
  })
  @IsString()
  @MaxLength(64)
  username!: string;

  @ApiPropertyOptional({
    description: 'Full name (optional).',
    example: 'Jane Doe',
  })
  @IsOptional()
  @IsString()
  fullName?: string;
}

export class CreateDelegatedDfnsUserDto {
  @ApiProperty({
    description: 'User email address (must be valid).',
    example: 'jane.doe@example.com',
  })
  @IsEmail()
  email!: string;
}
