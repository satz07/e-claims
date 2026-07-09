// src/modules/user-bank/user-bank.controller.ts

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
  Param,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';

import { UserBankService } from './dfns-user-bank.service';
import {
  CreateUserBankDto,
  UpdateBankStatusDto,
} from './dto/create-user-bank.dto';
import { PaginationDto } from './dto/pagination.dto';
import { AdminBankQueryDto } from './dto/admin-query.dto';
import { AdminDownloadQueryDto, DownloadTypeDTO } from './dto/download.dto';

import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { Role } from 'src/database/entities/users.entity';
import { CustomRequest } from 'src/types/Request';

@ApiTags('User Bank Accounts')
@ApiBearerAuth('access-token')
@Controller('user-bank')
export class UserBankController {
  constructor(private readonly service: UserBankService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a user bank account with supporting documents',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        accountName: { type: 'string', example: 'Saqib Altaf' },
        iban: { type: 'string', example: 'AE070331234567890123456' },
        documents: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
      required: ['accountName', 'iban'],
    },
  })
  @ApiOkResponse({ description: 'Bank account created successfully' })
  @UseInterceptors(
    FilesInterceptor('documents', 5, {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/(image\/jpeg|image\/png|application\/pdf)/)) {
          return cb(
            new BadRequestException(
              'Invalid file type. Only JPG, PNG, and PDF files are allowed.',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  create(
    @Body() dto: CreateUserBankDto,
    @UploadedFiles() documents: Express.Multer.File[],
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.create(dto, documents, req);
  }

  @Get('me')
  @ApiOperation({ summary: 'List logged-in user bank accounts' })
  @ApiOkResponse({
    description: 'Returns paginated bank accounts for current user',
  })
  listByUser(
    @Query() pageDto: PaginationDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.listByUser(pageDto, req);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin')
  @ApiOperation({ summary: '(ADMIN) List bank accounts with filters' })
  @ApiOkResponse({ description: 'Returns bank accounts for admin listing' })
  listForAdmin(@Query() query: AdminBankQueryDto) {
    return this.service.listForAdmin(query);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/status-count')
  @ApiOperation({
    summary: '(ADMIN) Get bank account counts grouped by status',
  })
  @ApiOkResponse({ description: 'Returns bank account counts by status' })
  countByStatus() {
    return this.service.countByStatus();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/download')
  @ApiOperation({ summary: '(ADMIN) Download bank accounts as PDF or CSV' })
  download(@Query() query: AdminDownloadQueryDto, @Res() res: Response) {
    if (query.downloadType === DownloadTypeDTO.PDF) {
      return this.service.downloadPDF(query, res);
    }

    return this.service.downloadCSV(query, res);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/:id/status')
  @ApiOperation({ summary: '(ADMIN) Update bank account status' })
  @ApiOkResponse({ description: 'Bank account status updated successfully' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBankStatusDto,
  ) {
    return this.service.updateStatus(id, dto);
  }
}
