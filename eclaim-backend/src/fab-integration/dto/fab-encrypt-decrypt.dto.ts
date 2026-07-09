// dto/encrypt-request.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class EncryptRequestDto {
  @ApiProperty({
    description: 'Plain JSON payload to encrypt',
    example: {
      transactionId: '550e8400-e29b-41d4-a716-446655440000',
    },
  })
  payload: Record<string, any>;
}

export class DecryptRequestDto {
  @ApiProperty({
    description: 'AES encrypted payload',
    example: 'QkZJcDk4Q...:GJDKS93...',
  })
  @IsString()
  encryptedPayload: string;
}
