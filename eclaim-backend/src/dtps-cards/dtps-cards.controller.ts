import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { DtpsCreateUserDto } from './dto/user/dtps-create-user.dto';
import { DtpsCardApplicationApplyDto } from './dto/card/dtps-card-application-apply.dto';
import { DtpsCardApplicationListQueryDto } from './dto/card/dtps-card-application-list-query.dto';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { CustomRequest } from 'src/types/Request';
import { DtpsService } from './dtps.cards.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { DtpsActivateCardDto } from './dto/card/dtps-activate-card.dto';
import { DtpsActivateReplacementCardDto } from './dto/card/dtps-activate-replacement-card.dto';
import { DtpsCardTxnHistoryQueryDto } from './dto/card/dtps-card-txn-history-query.dto';

@ApiTags('DTPS')
@ApiBearerAuth('access-token')
@Controller('public/dtps')
export class DtpsController {
  constructor(private readonly dtpsService: DtpsService) {}

  @Post('user/create')
  @ApiOperation({ summary: 'Create user in DTPS and store dtpsUserId locally' })
  @ApiBody({ type: DtpsCreateUserDto })
  async createUser(
    @CurrentUser() req: CustomRequest,
    @Body() dto: DtpsCreateUserDto,
  ) {
    return this.dtpsService.createUser(req.user.userId, dto);
  }

  @Post('user/document/upload')
  @ApiOperation({ summary: 'Upload user documents to DTPS' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        passport: {
          type: 'string',
          format: 'binary',
          description: 'Passport file',
        },
        signature: {
          type: 'string',
          format: 'binary',
          description: 'Signature file',
        },
        selfieWithPassport: {
          type: 'string',
          format: 'binary',
          description: 'Selfie with passport file',
        },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'passport', maxCount: 1 },
      { name: 'signature', maxCount: 1 },
      { name: 'selfieWithPassport', maxCount: 1 },
    ]),
  )
  async uploadUserDocuments(
    @CurrentUser() req: CustomRequest,
    @UploadedFiles()
    files: {
      passport?: Express.Multer.File[];
      signature?: Express.Multer.File[];
      selfieWithPassport?: Express.Multer.File[];
    },
  ) {
    // return this.dtpsService.uploadUserDocuments({ userId: 18 }, files);
    return this.dtpsService.uploadUserDocuments(
      { userId: req.user.userId },
      files,
    );
  }

  @Post('card/application/apply')
  @ApiOperation({ summary: 'Apply card application in DTPS' })
  @ApiBody({ type: DtpsCardApplicationApplyDto })
  async applyCardApplication(
    @CurrentUser() req: CustomRequest,
    @Body() dto: DtpsCardApplicationApplyDto,
  ) {
    // return this.dtpsService.applyCardApplication({ userId: 18 }, dto);
    return this.dtpsService.applyCardApplication(
      { userId: req.user.userId },
      dto,
    );
  }

  @Post('card/application/noverify/apply')
  @ApiOperation({
    summary: 'Apply card application in DTPS without verification',
  })
  @ApiBody({ type: DtpsCardApplicationApplyDto })
  async applyCardApplicationNoVerify(
    @CurrentUser() req: CustomRequest,
    @Body() dto: DtpsCardApplicationApplyDto,
  ) {
    // return this.dtpsService.applyCardApplicationNoVerify({ userId: 18 }, dto);
    return this.dtpsService.applyCardApplicationNoVerify(
      { userId: req.user.userId },
      dto,
    );
  }

  @Get('card/application/list')
  @ApiOperation({ summary: 'Get DTPS card application list' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  async listCardApplications(
    @Query() query: DtpsCardApplicationListQueryDto,
    @CurrentUser() req: CustomRequest,
  ) {
    // return this.dtpsService.listCardApplications(
    //   query.page ?? 1,
    //   query.limit ?? 10,
    //   { userId: 18 },
    // );
    return this.dtpsService.listCardApplications(
      query.page ?? 1,
      query.limit ?? 10,
      { userId: req.user.userId },
    );
  }
  //

  @Get('card/application/:id')
  @ApiOperation({ summary: 'Get DTPS card application by id' })
  @ApiParam({ name: 'id', example: '222' })
  async getCardApplicationById(@Param('id') id: string) {
    return this.dtpsService.getCardApplicationById(id);
  }

  @Post('card/activate')
  @ApiOperation({ summary: 'Activate DTPS card' })
  @ApiBody({ type: DtpsActivateCardDto })
  async activateCard(@Body() dto: DtpsActivateCardDto) {
    return this.dtpsService.activateCard(dto);
  }

  @Post('card/activate/replacement')
  @ApiOperation({ summary: 'Activate replacement DTPS card' })
  @ApiBody({ type: DtpsActivateReplacementCardDto })
  async activateReplacementCard(@Body() dto: DtpsActivateReplacementCardDto) {
    return this.dtpsService.activateReplacementCard(dto);
  }

  @Get('card/balance/id/:id')
  @ApiOperation({ summary: 'Get DTPS card balance by card id' })
  @ApiParam({ name: 'id', example: '1' })
  async getCardBalanceById(@Param('id') id: string) {
    return this.dtpsService.getCardBalanceById(id);
  }

  @Get('card/balance/:cardNumber')
  @ApiOperation({ summary: 'Get DTPS card balance by card number' })
  @ApiParam({ name: 'cardNumber', example: '212' })
  async getCardBalanceByCardNumber(@Param('cardNumber') cardNumber: string) {
    return this.dtpsService.getCardBalanceByCardNumber(cardNumber);
  }

  @Get('card/list')
  @ApiOperation({ summary: 'Get DTPS card list' })
  async listCards() {
    return this.dtpsService.listCards();
  }

  @Get('card/txnhistory/id/:id')
  @ApiOperation({ summary: 'Get DTPS card transaction history by card id' })
  @ApiParam({ name: 'id', example: '1' })
  async getCardTxnHistoryById(
    @Param('id') id: string,
    @Query() query: DtpsCardTxnHistoryQueryDto,
  ) {
    return this.dtpsService.getCardTxnHistoryById(
      id,
      query.startDate,
      query.endDate,
    );
  }

  @Get('card/txnhistory/:cardNumber')
  @ApiOperation({
    summary: 'Get DTPS card transaction history by card number',
  })
  @ApiParam({ name: 'cardNumber', example: '1234543' })
  async getCardTxnHistoryByCardNumber(
    @Param('cardNumber') cardNumber: string,
    @Query() query: DtpsCardTxnHistoryQueryDto,
  ) {
    return this.dtpsService.getCardTxnHistoryByCardNumber(
      cardNumber,
      query.startDate,
      query.endDate,
    );
  }
}
