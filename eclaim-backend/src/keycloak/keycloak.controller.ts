import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { KeycloakService } from './keycloak.service';
import { CreateUserDto } from './dto/create-user.dto';
// import { UpdatePasswordDto } from './dto/update-password.dto';
// import { GetUserDto } from './dto/get-user.dto';

@ApiTags('Keycloak')
@Controller('public/keycloak')
export class KeycloakController {
  constructor(private readonly keycloakService: KeycloakService) {}

  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @Post('create-user')
  async createUser(@Body() createUserDto: CreateUserDto) {
    const token = await this.keycloakService.getAdminToken();
    return await this.keycloakService.createUser(token, createUserDto.email);
  }

  //   @ApiOperation({ summary: 'Update user password' })
  //   @ApiResponse({ status: 200, description: 'Password updated successfully' })
  //   @Put('update-password')
  //   async updatePassword(@Body() updatePasswordDto: UpdatePasswordDto) {
  //     return await this.keycloakService.updatePassword(updatePasswordDto.userId);
  //   }

  //   @ApiOperation({ summary: 'Get user by email' })
  //   @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  //   @Get('get-user')
  //   async getUser(@Query() query: GetUserDto) {
  //     return await this.keycloakService.getUsers(query.email);
  //   }

  //   @ApiOperation({ summary: 'Get all users with roles' })
  //   @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  //   @Get('all-users')
  //   async getAllUsers(
  //     @Query('offset') offset: number = 0,
  //     @Query('max') max: number = 10,
  //   ) {
  //     return await this.keycloakService.getAllUsers(offset, max);
  //   }

  //   @ApiOperation({ summary: 'Get total user count' })
  //   @ApiResponse({
  //     status: 200,
  //     description: 'User count retrieved successfully',
  //   })
  //   @Get('user-count')
  //   async getUserCount() {
  //     return await this.keycloakService.getUserCount();
  //   }
}
