// src/modules/bank-info/bank-info.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MeService } from './me.service';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { CustomRequest } from 'src/types/Request';

@ApiTags('Me')
@ApiBearerAuth('access-token')
// @UseGuards(RolesGuard) // 👈 add this
// @Roles(Role.ADMIN)
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  @ApiOkResponse({
    description: 'Get information about the current user',
  })
  getMeInfo(@CurrentUser() req: CustomRequest) {
    return this.meService.getMeInfo(req);
  }
}
