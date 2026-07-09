// src/modules/fab-integration/fab-integration.controller.ts
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { FabIntegrationService } from './fab-integration.service';
import {
  FabAccountInfoHeaderDto,
  FabAccountInfoRequestDto,
  FabAccountInfoResponseDto,
} from './dto/fab-account-info.dto';
import {
  FabTransferHeaderDto,
  TransferRequestDto,
} from './dto/fab-account-transfer.dto';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import {
  FabNotificationHeaderDto,
  FabNotificationRequestDto,
  FabNotificationResponseDto,
} from './dto/fab-notification.dto';
import { CryptoService } from 'src/SharedService/crypto.shared';
import {
  DecryptRequestDto,
  EncryptRequestDto,
} from './dto/fab-encrypt-decrypt.dto';

@ApiTags('FAB Integration')
@Controller('fab')
export class FabIntegrationController {
  constructor(
    private readonly fabService: FabIntegrationService,
    private sharedCryptoService: CryptoService,
  ) {}

  // ==========================
  // GET APP TOKEN
  // ==========================
  @Get('auth/app-token')
  @ApiOkResponse({ description: 'Returns FAB application access token' })
  async getAppToken() {
    return this.fabService.getAppToken();
  }

  // ==========================
  // MAKE PAYMENT / TRANSFER
  // ==========================
  @Post('payments/transfer')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'FAB fund transfer API' })
  async transfer(
    @Headers() headers: FabTransferHeaderDto,
    @Body() body: TransferRequestDto, // use DTO here
  ) {
    // Optional: validate DTO manually
    const dto = plainToInstance(TransferRequestDto, body);
    await validateOrReject(dto);

    return this.fabService.transferFunds(
      headers.Authorization,
      headers.TRANSACTIONID,
      dto,
    );
  }

  @Post('account-info')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'FAB Account info response',
    type: FabAccountInfoResponseDto,
  })
  async getAccountInfo(
    @Headers() headers: FabAccountInfoHeaderDto,
    @Body() body: FabAccountInfoRequestDto,
  ): Promise<FabAccountInfoResponseDto> {
    // Call FAB service
    const fabResponse = await this.fabService.getAccountInfo(
      headers.Authorization,
      headers.TRANSACTIONID,
      body,
    );

    // Return encrypted FAB response
    return {
      messagePayload: fabResponse.messagePayload,
    };
  }

  @Post('notification')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'FAB notification endpoint',
    type: FabNotificationResponseDto,
  })
  async notification(
    @Headers() headers: FabNotificationHeaderDto,
    @Body() body: FabNotificationRequestDto,
  ): Promise<FabNotificationResponseDto> {
    return this.fabService.handleNotification(headers.Authorization, body);
  }

  @Post('auth/transaction-token')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Returns short-lived FAB transaction token' })
  async tokenForFab(@Body() body: DecryptRequestDto) {
    const decrypted = JSON.parse(
      this.sharedCryptoService.decrypt(body.encryptedPayload),
    ) as {
      payload: {
        transactionId: string;
      };
    };

    return this.fabService.generateFabTransactionToken(
      decrypted.payload.transactionId,
    );
  }

  @Post('auth/is-valid-token')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Returns short-lived FAB transaction token' })
  async isValidToken(@Query('token') token: string) {
    return this.fabService.isValidFabTransactionToken(token);
  }

  @Post('encrypt')
  @HttpCode(HttpStatus.OK)
  encrypt(@Body() body: EncryptRequestDto) {
    return {
      encryptedPayload: this.sharedCryptoService.encrypt(JSON.stringify(body)),
    };
  }

  // 🔓 Decrypt
  @Post('decrypt')
  @HttpCode(HttpStatus.OK)
  decrypt(@Body() body: DecryptRequestDto) {
    return {
      decrypted: JSON.parse(
        this.sharedCryptoService.decrypt(body.encryptedPayload),
      ),
    };
  }
}
