import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DtpsConfig } from 'src/config/config.type';
import { UserDtps } from 'src/database/entities/user-dtps.entity';
import { User } from 'src/database/entities/users.entity';
import { UserKyc } from 'src/database/entities/user-kyc.entity';
import { DtpsCreateUserDto } from './dto/user/dtps-create-user.dto';
import { DtpsCardApplicationApplyDto } from './dto/card/dtps-card-application-apply.dto';
import { DtpsActivateCardDto } from './dto/card/dtps-activate-card.dto';
import { DtpsActivateReplacementCardDto } from './dto/card/dtps-activate-replacement-card.dto';

async function loadSharp() {
  try {
    const mod = await import('sharp');
    return mod.default;
  } catch {
    throw new InternalServerErrorException(
      'Image processing (sharp) is not available on this server. Rebuild with: npm rebuild sharp --build-from-source',
    );
  }
}

@Injectable()
export class DtpsService {
  private readonly apiSecret: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(UserDtps)
    private readonly userDtpsRepo: Repository<UserDtps>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserKyc)
    private readonly userKycRepo: Repository<UserKyc>,
  ) {
    const dtps = this.configService.get<DtpsConfig>('dtps', { infer: true });

    this.apiSecret = dtps.secret_key;
    this.baseUrl = dtps.base_url;
    this.apiKey = dtps.api_key;
  }

  generateSignature(path: string, data?: string) {
    if (!path) {
      throw new Error('Path is required');
    }

    let message = path;
    if (data) {
      message += data;
    }

    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');
  }

  private async dtpsRequest(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, any>,
  ) {
    const payload = body ? JSON.stringify(body) : undefined;
    const signature = this.generateSignature(path, payload);

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'X-Api-Key': this.apiKey,
        'X-Api-Signature': signature,
        'Content-Type': 'application/json',
      },
      body: payload,
    });

    const rawText = await response.text();

    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = rawText;
    }

    if (!response.ok) {
      throw new HttpException(
        {
          statusCode: response.status,
          message:
            data?.message ||
            data?.error ||
            data?.errors?.[0]?.message ||
            rawText ||
            'DTPS request failed',
          error: 'DTPS_REQUEST_FAILED',
          dtpsError: data,
        },
        response.status,
      );
    }

    return data;
  }

  async createUser(localUserId: number, dto: DtpsCreateUserDto) {
    const user = await this.userRepo.findOne({
      where: { id: localUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingDtps = await this.userDtpsRepo.findOne({
      where: { userId: localUserId },
    });

    if (existingDtps) {
      throw new BadRequestException('DTPS user already linked with this user');
    }

    const kyc = await this.userKycRepo.findOne({
      where: { email: user.email },
    });

    const path = '/api/v1/user/create';
    const data = await this.dtpsRequest('POST', path, dto);

    if (!data?.id) {
      throw new InternalServerErrorException(
        'DTPS user created but response id was missing',
      );
    }

    const dtpsRecord = this.userDtpsRepo.create({
      dtpsUserId: data.id,
      userId: user.id,
      kycId: kyc?.id ?? null,
    });

    const saved = await this.userDtpsRepo.save(dtpsRecord);

    return {
      message: 'DTPS user created successfully',
      dtpsUserId: saved.dtpsUserId,
      localDtpsRecordId: saved.id,
      data,
    };
  }

  async uploadUserDocuments(
    dto: { userId: number },
    files: {
      passport?: Express.Multer.File[];
      signature?: Express.Multer.File[];
      selfieWithPassport?: Express.Multer.File[];
    },
  ) {
    const userDtps = await this.userDtpsRepo.findOne({
      where: { userId: dto.userId },
    });

    if (!userDtps) {
      throw new NotFoundException('DTPS user not found for the given userId');
    }

    const documents: Array<{ base64data: string; docName: string }> = [];

    const toPngBase64 = async (file: Express.Multer.File) => {
      if (!file?.buffer) {
        throw new BadRequestException('Invalid file upload');
      }

      const sharp = await loadSharp();
      const pngBuffer = await sharp(file.buffer).png().toBuffer();
      return `data:image/png;base64,${pngBuffer.toString('base64')}`;
    };

    if (files.passport?.[0]) {
      documents.push({
        base64data: await toPngBase64(files.passport[0]),
        docName: 'PASSPORT',
      });
    }

    if (files.signature?.[0]) {
      documents.push({
        base64data: await toPngBase64(files.signature[0]),
        docName: 'SIGNATURE',
      });
    }

    if (files.selfieWithPassport?.[0]) {
      documents.push({
        base64data: await toPngBase64(files.selfieWithPassport[0]),
        docName: 'SELFIE_WITH_PASSPORT',
      });
    }

    if (!documents.length) {
      throw new BadRequestException(
        'At least one document is required: passport, signature, or selfieWithPassport',
      );
    }

    const payload = {
      userId: userDtps.dtpsUserId,
      documents,
    };

    const path = '/api/v1/user/document/upload';
    const data = await this.dtpsRequest('POST', path, payload);

    return {
      success: true,
      message: 'DTPS user documents uploaded successfully',
      data,
    };
  }

  async applyCardApplication(
    { userId }: { userId: number },
    dto: DtpsCardApplicationApplyDto,
  ) {
    const userDtps = await this.userDtpsRepo.findOne({
      where: { userId },
    });

    if (!userDtps) {
      throw new NotFoundException('DTPS user not found for the given userId');
    }

    const path = '/api/v1/card/application/apply';
    const data = await this.dtpsRequest('POST', path, {
      ...dto,
      userId: userDtps.dtpsUserId,
    });

    return {
      success: true,
      message: 'DTPS card application submitted successfully',
      data,
    };
  }

  async applyCardApplicationNoVerify(
    { userId }: { userId: number },
    dto: DtpsCardApplicationApplyDto,
  ) {
    const userDtps = await this.userDtpsRepo.findOne({
      where: { userId },
    });

    if (!userDtps) {
      throw new NotFoundException('DTPS user not found for the given userId');
    }

    const path = '/api/v1/card/application/noverify/apply';
    const data = await this.dtpsRequest('POST', path, {
      ...dto,
      userId: userDtps.dtpsUserId,
    });

    return {
      success: true,
      message: 'DTPS card application (no verify) submitted successfully',
      data,
    };
  }

  async listCardApplications(
    page = 1,
    limit = 10,
    { userId }: { userId: number },
  ) {
    const path = `/api/v1/card/application/list?page=${page}&limit=${limit}`;
    const data = await this.dtpsRequest('GET', path);

    const userDtps = await this.userDtpsRepo.findOne({
      where: { userId },
    });

    if (!userDtps) {
      throw new NotFoundException('DTPS user not found for the given userId');
    }
    console.log('DTPS card application list response:', data, userDtps);
    const filtered = data?.filter(
      (app: any) => app.userId === userDtps.dtpsUserId,
    );
    console.log(filtered, 'Filtered applications for userId', userId);

    return {
      success: true,
      message: 'DTPS card applications fetched successfully',
      data: filtered,
    };
  }

  async getCardApplicationById(id: string) {
    const path = `/api/v1/card/application/${id}`;
    const data = await this.dtpsRequest('GET', path);

    return {
      success: true,
      message: 'DTPS card application fetched successfully',
      data,
    };
  }

  async activateCard(dto: DtpsActivateCardDto) {
    const path = '/api/v1/card/activate';
    const data = await this.dtpsRequest('POST', path, dto);

    return {
      success: true,
      message: 'DTPS card activated successfully',
      data,
    };
  }

  async activateReplacementCard(dto: DtpsActivateReplacementCardDto) {
    const path = '/api/v1/card/activate/replacement';
    const data = await this.dtpsRequest('POST', path, dto);

    return {
      success: true,
      message: 'DTPS replacement card activated successfully',
      data,
    };
  }

  async getCardBalanceById(id: string) {
    const path = `/api/v1/card/balance/id/${id}`;
    const data = await this.dtpsRequest('GET', path);

    return {
      success: true,
      message: 'DTPS card balance fetched successfully by id',
      data,
    };
  }

  async getCardBalanceByCardNumber(cardNumber: string) {
    const path = `/api/v1/card/balance/${cardNumber}`;
    const data = await this.dtpsRequest('GET', path);

    return {
      success: true,
      message: 'DTPS card balance fetched successfully by card number',
      data,
    };
  }

  async listCards() {
    const path = `/api/v1/card/list`;
    const data = await this.dtpsRequest('GET', path);

    return {
      success: true,
      message: 'DTPS cards fetched successfully',
      data,
    };
  }

  async getCardTxnHistoryById(id: string, startDate: string, endDate: string) {
    const query = new URLSearchParams({
      startDate,
      endDate,
    }).toString();

    const path = `/api/v1/card/txnhistory/id/${id}?${query}`;
    const data = await this.dtpsRequest('GET', path);

    return {
      success: true,
      message: 'DTPS card transaction history fetched successfully by id',
      data,
    };
  }

  async getCardTxnHistoryByCardNumber(
    cardNumber: string,
    startDate: string,
    endDate: string,
  ) {
    const query = new URLSearchParams({
      startDate,
      endDate,
    }).toString();

    const path = `/api/v1/card/txnhistory/${cardNumber}?${query}`;
    const data = await this.dtpsRequest('GET', path);

    return {
      success: true,
      message:
        'DTPS card transaction history fetched successfully by card number',
      data,
    };
  }
}
