// src/modules/bank-info/bank-info.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOkResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { BankInfoService } from './dfns-bank-info.service';

@ApiTags('Bank Information')
@ApiBearerAuth('access-token') // must match DocumentBuilder
// @UseGuards(RolesGuard) // 👈 add this
// @Roles(Role.ADMIN)
@Controller('bank-info')
export class BankInfoController {
  constructor(private readonly bankInfoService: BankInfoService) {}

  @Get()
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Get DDSC bank information' })
  @ApiOkResponse({
    description: 'Returns DDSC bank information and important notice',
  })
  getBankInfo() {
    return this.bankInfoService.getBankInfo();
  }

  @Get('bolias')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Get Bolias bank information' })
  @ApiOkResponse({
    description: 'Returns Bolias bank information and important notice',
  })
  getBoliasBankInfo() {
    return this.bankInfoService.getBoliasBankInfo();
  }

  @Get('infinia')
  @ApiOperation({ summary: 'Get Infinia bank information' })
  @ApiOkResponse({
    description: 'Returns Infinia bank information and important notice',
  })
  getInfiniaBankInfo() {
    return this.bankInfoService.getBoliasBankInfo();
  }
}
