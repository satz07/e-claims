// src/modules/auth/auth.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UserLoginDto } from './dto/login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';

@ApiTags('Admin Auth')
@Controller('admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('register-admin')
  @ApiOkResponse({ description: 'Register first admin' })
  @ApiBadRequestResponse({ description: 'Admin already exists' })
  async registerAdmin(@Body() dto: CreateAdminDto) {
    return this.authService.registerAdmin(dto);
  }
  @Post('login')
  @ApiOperation({ summary: 'Admin login' })
  @ApiOkResponse({ description: 'Admin logged in successfully' })
  async login(@Body() dto: UserLoginDto) {
    return this.authService.login(dto);
  }
}
