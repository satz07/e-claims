import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { UserManagementService } from './user-management.service';
import {
  SendEmailCodeDto,
  VerifyEmailCodeDto,
  RegisterInitDto,
  RegisterCompleteDto,
  LoginInitDto,
  LoginCompleteDto,
  ResetPasskeyInitDto,
  ResetPasskeyCompleteDto,
  TwoFaToggleCompleteDto,
  LoginTwoFaVerifyDto,
} from './dto/user-management.dto';

import { CurrentUser } from 'src/common/decorators/user.decorator';
import { CustomRequest } from 'src/types/Request';

@ApiTags('Users')
@Controller('')
export class UserManagementController {
  constructor(private readonly userService: UserManagementService) {}

  @Post('public/users/create')
  @ApiOperation({ summary: 'Create a new user by email' })
  @ApiOkResponse({ description: 'User created successfully' })
  async create(@Body() body: SendEmailCodeDto) {
    return this.userService.createUser(body.email);
  }

  @Post('public/users/send-email-code')
  @ApiOperation({ summary: 'Send email verification code for registration' })
  @ApiOkResponse({ description: 'Verification code sent successfully' })
  async sendEmailCode(@Body() body: SendEmailCodeDto) {
    return this.userService.sendEmailCode(body.email);
  }

  @Post('public/users/verify-email-code')
  @ApiOperation({ summary: 'Verify email code for registration' })
  @ApiOkResponse({ description: 'Email verification successful' })
  async verifyEmailCode(@Body() body: VerifyEmailCodeDto) {
    return this.userService.verifyEmailCode(body.email, body.code);
  }

  @Post('public/users/register/init')
  @ApiOperation({ summary: 'Initialize passkey registration' })
  @ApiOkResponse({ description: 'Registration challenge generated' })
  async registerInit(@Body() body: RegisterInitDto) {
    return this.userService.registerInit(body.emailVerificationToken);
  }

  @Post('public/users/register/complete')
  @ApiOperation({ summary: 'Complete passkey registration' })
  @ApiOkResponse({ description: 'User registered successfully' })
  async registerComplete(@Body() body: RegisterCompleteDto) {
    return this.userService.registerComplete(
      body.temporaryAuthenticationToken,
      body.firstFactorCredential,
    );
  }

  @Post('public/users/login/init')
  @ApiOperation({ summary: 'Initialize login using passkey' })
  @ApiOkResponse({ description: 'Login challenge generated' })
  async loginInit(@Body() body: LoginInitDto) {
    return this.userService.loginInit(body.email);
  }

  @Post('public/users/login/complete')
  @ApiOperation({ summary: 'Complete login using passkey' })
  @ApiOkResponse({ description: 'Login successful or 2FA required' })
  async loginComplete(@Body() body: LoginCompleteDto) {
    return this.userService.loginComplete(
      body.temporaryAuthenticationToken,
      body.assertionResponse,
    );
  }

  @Post('public/users/login/2fa/verify')
  @ApiOperation({ summary: 'Verify login 2FA code and issue access token' })
  @ApiOkResponse({ description: '2FA verification successful' })
  async loginTwoFaVerify(@Body() body: LoginTwoFaVerifyDto) {
    return this.userService.loginTwoFaVerify(
      body.temporaryTwoFactorToken,
      body.code,
    );
  }

  @Post('public/users/reset/send-email-code')
  @ApiOperation({ summary: 'Send reset passkey email verification code' })
  @ApiOkResponse({ description: 'Reset verification code sent' })
  async sendResetEmailCode(@Body() body: SendEmailCodeDto) {
    return this.userService.sendResetEmailCode(body.email);
  }

  @Post('public/users/reset/verify-email-code')
  @ApiOperation({ summary: 'Verify reset passkey email code' })
  @ApiOkResponse({ description: 'Reset email verification successful' })
  async verifyResetEmailCode(@Body() body: VerifyEmailCodeDto) {
    return this.userService.verifyResetEmailCode(body.email, body.code);
  }

  @Post('public/users/reset-passkey/init')
  @ApiOperation({ summary: 'Initialize passkey reset' })
  @ApiOkResponse({ description: 'Reset passkey challenge generated' })
  async resetPasskeyInit(@Body() body: ResetPasskeyInitDto) {
    return this.userService.resetPasskeyInit(body.resetEmailVerificationToken);
  }

  @Post('public/users/reset-passkey/complete')
  @ApiOperation({ summary: 'Complete passkey reset' })
  @ApiOkResponse({ description: 'Passkey reset successful' })
  async resetPasskeyComplete(@Body() body: ResetPasskeyCompleteDto) {
    return this.userService.resetPasskeyComplete(
      body.temporaryAuthenticationToken,
      body.firstFactorCredential,
    );
  }

  @ApiBearerAuth('access-token')
  @Post('users/2fa/toggle/init')
  @ApiOperation({ summary: 'Initialize 2FA enable/disable flow' })
  @ApiOkResponse({ description: '2FA toggle challenge generated' })
  async twoFaToggleInit(@CurrentUser() req: CustomRequest) {
    return this.userService.twoFaToggleInit(req);
  }

  @ApiBearerAuth('access-token')
  @Post('users/2fa/toggle/complete')
  @ApiOperation({ summary: 'Complete 2FA enable/disable flow' })
  @ApiOkResponse({ description: '2FA status updated successfully' })
  async twoFaToggleComplete(@Body() body: TwoFaToggleCompleteDto) {
    return this.userService.twoFaToggleComplete(
      body.temporaryAuthenticationToken,
      body.enabled,
      body.assertionResponse,
    );
  }
}
