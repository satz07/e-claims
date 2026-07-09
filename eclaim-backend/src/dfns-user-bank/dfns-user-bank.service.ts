// src/modules/user-bank/user-bank.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Response } from 'express';
import {
  CreateUserBankDto,
  UpdateBankStatusDto,
} from './dto/create-user-bank.dto';
import { UserKyc } from 'src/database/entities/user-kyc.entity';
import { BankStatus, UserBank } from 'src/database/entities/user-bank.entity';
import { PaginationDto } from './dto/pagination.dto';
import {
  AdminBankQueryDto,
  BankStatusFilter,
  UserTypeFilter,
} from './dto/admin-query.dto';
import { getDocumentUrls, uploadFilesToAzure } from 'src/config/s3-config';
import { WalletService } from 'src/wallet/wallet.service';
import {
  AdminDownloadQueryDto,
  BankStatusDTO,
  UserTypeDTO,
} from './dto/download.dto';
import { buildExportRows } from 'src/utils/download/export.util';
import { bankExportColumns } from './export/bank-export.config';
import { sendCSV } from 'src/utils/download/csv.util';
import { sendPDF } from 'src/utils/download/pdf.util';
import { CustomRequest } from 'src/types/Request';

@Injectable()
export class UserBankService {
  constructor(
    @InjectRepository(UserBank)
    private readonly bankRepo: Repository<UserBank>,
    @InjectRepository(UserKyc)
    private readonly kycRepo: Repository<UserKyc>,
    private readonly walletService: WalletService,
  ) {}

  async create(
    dto: CreateUserBankDto,
    files: Express.Multer.File[],
    req: CustomRequest,
  ) {
    const { userId, email } = req.user;

    if (!userId || !email) throw new BadRequestException('Invalid token');

    const kyc = await this.kycRepo.findOne({ where: { email } });
    if (!kyc) throw new NotFoundException('KYC record not found');

    const exists = await this.bankRepo.findOne({
      where: { userId, iban: dto.iban },
    });
    if (exists) throw new BadRequestException('This IBAN is already added');

    // ✅ FILE VALIDATION (FIX)
    if (files?.length) {
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];

      for (const file of files) {
        if (!allowedMimeTypes.includes(file.mimetype)) {
          throw new BadRequestException(
            `Invalid file type (${file.originalname}). Only JPG, PNG or PDF files are allowed.`,
          );
        }
      }
    }
    // 1️⃣ Create bank record
    const bank = await this.bankRepo.save(
      this.bankRepo.create({
        userId,
        kycId: kyc.id,
        accountName: dto.accountName,
        iban: dto.iban,
        status: 'Pending',
      }),
    );

    // 2️⃣ Upload documents using reusable function
    const documentUrls = await uploadFilesToAzure(files, `bank/${bank.id}`);

    // 3️⃣ Save relative paths to DB
    if (documentUrls.length) {
      await this.bankRepo.update(bank.id, { documents: documentUrls });
    }
    return {
      ...bank,
      documents: documentUrls,
    };
  }

  async listByUser(pageDto: PaginationDto, req: CustomRequest) {
    const { userId } = req.user;
    if (!userId) throw new BadRequestException('Invalid token');

    const page = pageDto.page ?? 1;
    const limit = pageDto.limit ?? 10;

    const [data, total] = await this.bankRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateStatus(id: number, dto: UpdateBankStatusDto) {
    const bank = await this.bankRepo.findOne({ where: { id } });
    if (!bank) throw new NotFoundException('Bank record not found');

    bank.status = dto.status;
    if (dto.reason) bank.reason = dto.reason;

    return this.bankRepo.save(bank);
  }

  async listForAdmin(query: AdminBankQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: FindOptionsWhere<UserBank> = {};

    if (query.status && query.status !== BankStatusFilter.All) {
      where.status = query.status;
    }

    if (query.userType && query.userType !== UserTypeFilter.All) {
      const kycUsers = await this.kycRepo.find({
        select: ['id'],
        where: { accountType: query.userType },
      });

      const userIds = kycUsers.map((k) => k.id);

      if (userIds.length === 0) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
      }

      where.kycId = In(userIds);
    }

    const [banks, total] = await this.bankRepo.findAndCount({
      where,
      relations: ['kyc'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // ✅ Safe wallet fetch
    let walletData: any = { items: [] };

    try {
      walletData = await this.walletService.getAllWallets();
    } catch (error) {
      console.error('Wallet service failed:', error?.message);
      // fallback: keep empty wallet list
    }

    const banksWithDocuments = await Promise.all(
      banks.map(async (bank) => {
        const userId = bank.userId;
        const creatorTag = `creator:${userId}`;

        const filteredWallets =
          walletData?.items?.filter(
            (w) => Array.isArray(w.tags) && w.tags.includes(creatorTag),
          ) ?? [];

        const walletAddress =
          filteredWallets.length > 0 ? filteredWallets[0].address : 'N/A';

        const documentPaths = bank.documents || [];

        const documents = documentPaths.map((path) => {
          const fileName = path.split('/').pop();
          const url = getDocumentUrls(path)[0];
          return { fileName, url };
        });

        return {
          ...bank,
          documents,
          walletAddress,
        };
      }),
    );

    return {
      data: banksWithDocuments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  // Count bank accounts by status using repository methods
  async countByStatus(): Promise<Record<string, number>> {
    const statuses: BankStatus[] = [
      'Pending',
      'Approved',
      'OnHold',
      'Rejected',
    ];

    const result: Record<string, number> = {
      pending: 0,
      approved: 0,
      onHold: 0,
      rejected: 0,
    };

    for (const status of statuses) {
      const count = await this.bankRepo.count({ where: { status } });

      // Convert BankStatus to camelCase key
      let key: string;
      switch (status) {
        case 'Pending':
          key = 'pending';
          break;
        case 'Approved':
          key = 'approved';
          break;
        case 'OnHold':
          key = 'onHold';
          break;
        case 'Rejected':
          key = 'rejected';
          break;
        default:
          key = status; // fallback
      }

      result[key] = count;
    }

    return result;
  }

  async download(body: AdminDownloadQueryDto) {
    const where: any = {};

    if (body.userType && !Object.values(UserTypeDTO).includes(body.userType)) {
      throw new BadRequestException('Invalid user type');
    }

    if (body.status && !Object.values(BankStatusDTO).includes(body.status)) {
      throw new BadRequestException('Invalid bank status');
    }

    if (body.status) {
      where.status = body.status;
    }

    if (body.userType) {
      const kycUsers = await this.kycRepo.find({
        select: ['id'],
        where: { accountType: body.userType },
      });

      if (!kycUsers.length) return [];

      const userIds = kycUsers.map((k) => k.id);
      where.kycId = In(userIds);
    }

    // Fetch banks with optional filters
    const banks = await this.bankRepo.find({
      where,
      relations: ['kyc'],
      order: { createdAt: 'DESC' },
    });

    return banks;
  }

  async downloadPDF(body: AdminDownloadQueryDto, res: Response) {
    const banks = await this.download(body);
    const rows = buildExportRows(banks, bankExportColumns);
    const headers = bankExportColumns.map((c) => c.header);
    sendPDF(rows, headers, res, 'Bank List', 'banks.pdf');
  }

  async downloadCSV(body: AdminDownloadQueryDto, res: Response) {
    const banks = await this.download(body);
    const rows = buildExportRows(banks, bankExportColumns);
    const headers = bankExportColumns.map((c) => c.header);
    sendCSV(rows, headers, res, 'banks.csv');
  }
}
