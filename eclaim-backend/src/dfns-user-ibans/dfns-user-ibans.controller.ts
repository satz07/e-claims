import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUserIbanDto } from './dto/create-user-iban.dto';
import { UserIbanService } from './dfns-user-ibans.service';
import { PaginationDto } from './dto/pagination.dto';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { CustomRequest } from 'src/types/Request';

@ApiTags('User Beneficiary IBAN')
@ApiBearerAuth('access-token')
@Controller('user-ibans')
export class UserIbanController {
  constructor(private readonly service: UserIbanService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new beneficiary IBAN' })
  @ApiResponse({ status: 201, description: 'IBAN created successfully' })
  async create(
    @Body() dto: CreateUserIbanDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.create(dto, req);
  }

  @Get()
  @ApiOperation({ summary: 'Get all beneficiary IBANs' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'User IBANs fetched successfully' })
  async findAllByCurrentUser(
    @Query() pageDto: PaginationDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.findByUser(req, pageDto);
  }

  @Delete(':ibanId')
  @ApiOperation({ summary: 'Delete beneficiary IBAN by ID' })
  @ApiParam({ name: 'ibanId', example: '1', description: 'IBAN record ID' })
  @ApiResponse({ status: 200, description: 'IBAN deleted successfully' })
  async deleteById(
    @Param('ibanId') ibanId: number,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.deleteById(req, ibanId);
  }
}
