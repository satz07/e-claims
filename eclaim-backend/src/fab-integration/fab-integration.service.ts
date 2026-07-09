import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import { FabCryptoService } from './fab-crypto.service';
import { FabAccountInfoRequestDto } from './dto/fab-account-info.dto';
import { TransferRequestDto } from './dto/fab-account-transfer.dto';
import {
  FabNotificationRequestDto,
  FabNotificationResponseDto,
} from './dto/fab-notification.dto';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class FabIntegrationService {
  private readonly tokenUrl: string;
  private readonly paymentUrl: string;
  private readonly accountInfoUrl: string;
  private readonly clientId: string;
  private readonly clientAssertion: string;
  private readonly channelId: string;

  constructor(
    private readonly crypto: FabCryptoService,
    private readonly configService: ConfigService,
  ) {
    this.tokenUrl = this.configService.get<string>('fab.tokenUrl', {
      infer: true,
    });
    this.paymentUrl = this.configService.get<string>('fab.paymentUrl', {
      infer: true,
    });
    this.accountInfoUrl = this.configService.get<string>('fab.accountInfoUrl', {
      infer: true,
    });
    this.clientId = this.configService.get<string>('fab.clientId', {
      infer: true,
    });
    this.clientAssertion = this.configService.get<string>(
      'fab.clientAssertion',
      { infer: true },
    );
    this.channelId = this.configService.get<string>('fab.channelId', {
      infer: true,
    });
  }

  // ==========================
  // AUTH
  // ==========================
  async getAppToken(): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
  }> {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_assertion_type:
        'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: this.clientAssertion,
    });

    const res = await fetch(`${this.tokenUrl}?${params.toString()}`, {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) throw new HttpException(data, res.status);
    return data;
  }

  // ==========================
  // PAYMENTS
  // ==========================
  async transferFunds(
    auth: string,
    transactionId: string,
    payload: TransferRequestDto,
  ) {
    // Encrypt the payload (already structured)
    const encrypted = this.crypto.encrypt(JSON.stringify(payload));

    // Make the request
    const res = await fetch(this.paymentUrl, {
      method: 'POST',
      headers: {
        Authorization: auth,
        CHANNELID: this.channelId,
        TRANSACTIONID: transactionId,
        TRANSACTIONDATETIME: new Date().toISOString(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messagePayload: encrypted }),
    });

    const data = await res.json();
    if (!res.ok) throw new HttpException(data, res.status);

    return data;
  }

  // ==========================
  // ACCOUNT INFO
  // ==========================
  async getAccountInfo(
    auth: string,
    transactionId: string,
    payload: FabAccountInfoRequestDto,
  ) {
    // Encrypt request
    const decrypted = JSON.parse(this.crypto.decrypt(payload.messagePayload));
    const res = await fetch(this.accountInfoUrl, {
      method: 'POST',
      headers: {
        Authorization: auth,
        CHANNELID: this.channelId,
        TRANSACTIONID: transactionId,
        TRANSACTIONDATETIME: new Date().toISOString(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messagePayload: decrypted,
        customerIdentifier: payload.customerIdentifier,
        accountIdentifier: payload.accountIdentifier,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new HttpException(data, res.status);

    // Decrypt response
    if (data.messagePayload) {
      return {
        messagePayload: this.crypto.decrypt(data.messagePayload),
      };
    }

    return data;
  }

  async handleNotification(
    auth: string,
    payload: FabNotificationRequestDto,
  ): Promise<FabNotificationResponseDto> {
    // Here you can handle the payload:
    // - Save to DB
    // - Trigger other business logic
    // - Validate amounts or status

    console.log('Received FAB notification:', payload, auth);

    // Return success response
    return {
      channelTransactionId: payload.channelTransactionId,
      status: 'success',
      errorCode: '0',
    };
  }

  generateFabTransactionToken(transactionId: string): {
    token: string;
    expiresIn: number;
  } {
    const expectedSecret = this.configService.get<string>(
      'fab.txnTokenSecret',
      { infer: true },
    );

    const token = jwt.sign(
      {
        transactionId,
        scope: 'FAB_TRANSACTION',
      },
      expectedSecret,
      {
        expiresIn: '60s',
      },
    );

    return {
      token,
      expiresIn: 60,
    };
  }

  isValidFabTransactionToken(token: string): {
    valid: boolean;
    transactionId?: string;
  } {
    const secret = this.configService.get<string>('fab.txnTokenSecret', {
      infer: true,
    });

    try {
      const decoded = jwt.verify(token, secret) as {
        transactionId: string;
        scope: string;
      };
      if (decoded.scope !== 'FAB_TRANSACTION') {
        return { valid: false };
      }
      return { valid: true, transactionId: decoded.transactionId };
    } catch (err) {
      return { valid: false };
    }
  }
}
