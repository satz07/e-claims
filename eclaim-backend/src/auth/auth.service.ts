// src/modules/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

import { UserLoginDto } from './dto/login.dto';
import { Role, User } from 'src/database/entities/users.entity';
import { CreateAdminDto } from './dto/create-admin.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async registerAdmin(dto: CreateAdminDto) {
    // Check if any admin exists
    const existingAdmin = await this.userRepo.findOne({
      where: { role: Role.ADMIN },
    });
    if (existingAdmin) {
      throw new BadRequestException('Admin already exists.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const admin = this.userRepo.create({
      email: dto.email,
      password: hashedPassword,
      role: Role.ADMIN,
      isActive: true,
    });

    return this.userRepo.save(admin);
  }

  private signAccessToken(user: User) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: randomUUID(),
    });
  }
  async login(dto: UserLoginDto) {
    const admin = await this.userRepo.findOne({
      where: { email: dto.email, isActive: true },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      accessToken: this.signAccessToken(admin),
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    };
  }
}
