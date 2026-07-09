// src/modules/bank-transaction/bank-transaction.controller.ts

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Param,
  ParseIntPipe,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
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

import { BankTransactionService } from './dfns-bank-transaction.service';
import {
  CreateBankTransactionDto,
  UpdateBankTransactionStatusDto,
} from './dto/create-bank-transaction.dto';
import { PaginationDto } from './dto/pagination.dto';
import { AdminBankTransactionQueryDto } from './dto/admin-bank-transaction-query.dto';
import { AdminDownloadQueryDto, DownloadTypeDTO } from './dto/download.dto';

import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { Role } from 'src/database/entities/users.entity';
import { CustomRequest } from 'src/types/Request';

@ApiTags('Bank Transactions')
@ApiBearerAuth('access-token')
@Controller('bank-transaction')
export class BankTransactionController {
  constructor(private readonly service: BankTransactionService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a bank transaction with supporting documents',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        transactionType: { type: 'string', example: 'Deposit' },
        amount: { type: 'number', example: 1500 },
        bankId: { type: 'number', example: 1 },
        referenceNo: { type: 'string', example: 'TXN-20260306-001' },
        documents: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
      required: ['transactionType', 'amount', 'bankId'],
    },
  })
  @ApiOkResponse({ description: 'Bank transaction created successfully' })
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
  async create(
    @Body() dto: CreateBankTransactionDto,
    @UploadedFiles() documents: Express.Multer.File[],
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.create(dto, documents, req);
  }

  @Get('me')
  @ApiOperation({ summary: 'List logged-in user bank transactions' })
  @ApiOkResponse({
    description: 'Returns paginated bank transactions for current user',
  })
  async listByUser(
    @Query() query: PaginationDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.listByUser(
      query.page,
      query.limit,
      req,
      query.transactionType,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin')
  @ApiOperation({ summary: '(ADMIN) List bank transactions with filters' })
  @ApiOkResponse({ description: 'Returns bank transactions for admin listing' })
  async listForAdmin(@Query() query: AdminBankTransactionQueryDto) {
    return this.service.listForAdmin(query);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/status-count')
  @ApiOperation({ summary: '(ADMIN) Get transaction counts grouped by status' })
  @ApiOkResponse({ description: 'Returns bank transaction counts by status' })
  async countByStatus() {
    return this.service.countByStatus();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/download')
  @ApiOperation({ summary: '(ADMIN) Download bank transactions as PDF or CSV' })
  download(@Query() query: AdminDownloadQueryDto, @Res() res: Response) {
    if (query.downloadType === DownloadTypeDTO.PDF) {
      return this.service.downloadPDF(query, res);
    }

    return this.service.downloadCSV(query, res);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/:id/status')
  @ApiOperation({ summary: '(ADMIN) Update bank transaction status' })
  @ApiOkResponse({
    description: 'Bank transaction status updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid input or bank transaction not found',
  })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBankTransactionStatusDto,
  ) {
    return this.service.updateStatus(id, dto);
  }
}
