import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Delete,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CreateDelegatedDfnsUserDto,
  CreateDfnsUserDto,
} from './dto/create-dfns-user.dto';
import { DNFSUsermanagementService } from './dfns-user-management.service';
import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { LoginCompleteDto, LoginInitDto } from './dto/auth-dtos';
import {
  RegistrationCompleteDto,
  RegistrationInitDto,
  ResendRegistrationCodeDto,
} from './dto/registration-complete.dto';

@ApiTags('User Management')
@Controller('users')
export class DNFSUsermanagementController {
  constructor(
    private readonly dfnsUsermanagementService: DNFSUsermanagementService,
  ) {}

  /** List DFNS users; optionally filter by externalId/email */
  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({ name: 'email', required: true, description: 'Filter by email' })
  listEndUsers(@Query('email') email?: string) {
    return this.dfnsUsermanagementService.listDfnsUsers({ email });
  }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  createUser(@Body() body: CreateDfnsUserDto) {
    return this.dfnsUsermanagementService.createUserManual(body);
  }

  @Put('registration/code')
  @HttpCode(HttpStatus.OK)
  async sendCode(@Body() body: ResendRegistrationCodeDto) {
    await this.dfnsUsermanagementService.sendRegistrationCode(body.username);
    return { success: true, message: 'Registration code sent.' };
  }

  /** 2) Init registration with username + code (returns temp token + WebAuthn options) */
  @Post('registration/init')
  @HttpCode(HttpStatus.OK)
  registrationInit(@Body() body: RegistrationInitDto) {
    return this.dfnsUsermanagementService.registrationInit(
      body.username,
      body.registrationCode,
    );
  }

  @Post('registration/complete')
  @HttpCode(HttpStatus.OK)
  async registrationComplete(@Body() body: RegistrationCompleteDto) {
    // Drop accidental empty {} 2FA
    if (
      body.secondFactorCredential &&
      Object.keys(body.secondFactorCredential as any).length === 0
    ) {
      delete (body as any).secondFactorCredential;
    }

    try {
      const res =
        await this.dfnsUsermanagementService.registrationComplete(body);
      return { ok: true, data: res };
    } catch (err: any) {
      const msg: string = String(err?.message ?? err);
      const jsonMatch = msg.match(/\{[\s\S]*\}$/);
      let dfnsError: any;
      if (jsonMatch) {
        try {
          dfnsError = JSON.parse(jsonMatch[0]);
        } catch {}
      }

      const status = / 401 /.test(msg)
        ? 401
        : / 403 /.test(msg)
        ? 403
        : / 400 /.test(msg)
        ? 400
        : 400;

      const reason =
        dfnsError?.error?.message ??
        (status === 401
          ? 'Unauthorized. If you previously registered, try to login instead.'
          : status === 403
          ? 'Forbidden'
          : 'Request body failed validation');

      const details = dfnsError?.error?.details;

      if (status === 401)
        throw new UnauthorizedException({ ok: false, message: reason });
      if (status === 403)
        throw new ForbiddenException({ ok: false, message: reason });
      throw new BadRequestException({
        ok: false,
        message: reason,
        ...(details ? { details } : {}),
      });
    }
  }

  /** 4) Start login (returns assertion options + challengeIdentifier) */
  @Post('login/init')
  @HttpCode(HttpStatus.OK)
  loginInit(@Body() body: LoginInitDto) {
    return this.dfnsUsermanagementService.loginInit(body.username);
  }

  /** 5) Finish login (returns DFNS user token) */
  @Post('login/complete')
  @HttpCode(HttpStatus.OK)
  loginComplete(@Body() body: LoginCompleteDto) {
    // Quick sanity checks (prevent common shape mistakes)
    const ff = (body as any)?.firstFactor;
    if (!ff || ff.kind !== 'Fido2' || !ff.credentialAssertion) {
      throw new BadRequestException(
        'firstFactor.kind must be "Fido2" and include credentialAssertion',
      );
    }
    const ca = ff.credentialAssertion;
    const required = [
      'credId',
      'clientData',
      'signature',
      'authenticatorData',
      'userHandle',
    ];
    const missing = required.filter((k) => !(k in ca));
    if (missing.length) {
      throw new BadRequestException(
        `Missing credentialAssertion fields: ${missing.join(', ')}`,
      );
    }

    return this.dfnsUsermanagementService.loginComplete(
      body.challengeIdentifier,
      body.firstFactor,
    );
  }

  @Post('users/create/delegated')
  @HttpCode(HttpStatus.CREATED)
  createUserDelegated(@Body() body: CreateDelegatedDfnsUserDto) {
    return this.dfnsUsermanagementService.createDelegatedUser(body);
  }

  @Post('login/delegated')
  @HttpCode(HttpStatus.OK)
  delegatedLoginInit(@Body() body: LoginInitDto) {
    return this.dfnsUsermanagementService.delegatedLogin(body.username);
  }

  /** Delete a DFNS user (use with caution). */
  @Delete('end-users/:userId')
  @HttpCode(HttpStatus.OK)
  deleteEndUser(@Param('userId') userId: string) {
    return this.dfnsUsermanagementService.deleteDfnsUser(userId);
  }

  /** Get a DFNS user by id */
  @Get('end-users/:userId')
  @HttpCode(HttpStatus.OK)
  getEndUser(@Param('userId') userId: string) {
    return this.dfnsUsermanagementService.getDfnsUser(userId);
  }
}
