import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString, MinLength } from 'class-validator';

/** POST /login/init */
export class LoginInitDto {
  @ApiProperty({ example: 'jane' })
  @IsString()
  @MinLength(1)
  username!: string;
}

/** POST /login/complete */
export class LoginCompleteDto {
  @ApiProperty()
  @IsString()
  challengeIdentifier!: string;

  @ApiProperty({
    description:
      'First factor for login: either WebAuthn assertion or password.',
    oneOf: [
      {
        example: {
          kind: 'Fido2',
          assertion: {
            id: 'base64url(rawId)',
            clientData: 'base64url(clientDataJSON)',
            authenticatorData: 'base64url(authenticatorData)',
            signature: 'base64url(signature)',
            userHandle: 'base64url(userHandle)',
          },
        },
      },
      {
        example: {
          kind: 'Password',
          password: 'StrongP@ssw0rd',
        },
      },
    ],
  })
  @IsObject()
  firstFactor!: Record<string, unknown>;
}
