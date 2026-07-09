// src/modules/bank-transaction/bank-transaction.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import {
  AdminBankTransactionQueryDto,
  UserTypeFilter,
  BankTransactionStatusFilter,
} from './dto/admin-bank-transaction-query.dto';
import {
  CreateBankTransactionDto,
  UpdateBankTransactionStatusDto,
} from './dto/create-bank-transaction.dto';
import {
  BankTransaction,
  BankTransactionStatus,
  BankTransactionType,
} from 'src/database/entities/bank-transaction.entity';
import { UserKyc } from 'src/database/entities/user-kyc.entity';
import { UserBank } from 'src/database/entities/user-bank.entity';
import { User, Role } from 'src/database/entities/users.entity';
import { Wallet } from 'src/database/entities/wallet.entity';
import { getDocumentUrls, uploadFilesToAzure } from 'src/config/s3-config';
import { WalletService } from 'src/wallet/wallet.service';
import {
  AdminDownloadQueryDto,
  BankTransactionStatusDTOs,
  UserTypeDTO,
} from './dto/download.dto';
import { buildExportRows } from 'src/utils/download/export.util';
import { transactionExportColumns } from './export/transactions-export.config';
import { sendPDF } from 'src/utils/download/pdf.util';
import { sendCSV } from 'src/utils/download/csv.util';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { CustomRequest } from 'src/types/Request';

@Injectable()
export class BankTransactionService {
  constructor(
    @InjectRepository(BankTransaction)
    private readonly bankTransactionRepo: Repository<BankTransaction>,
    @InjectRepository(UserKyc)
    private readonly kycRepo: Repository<UserKyc>,
    @InjectRepository(UserBank)
    private readonly userBankRepo: Repository<UserBank>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    private readonly walletService: WalletService,
    private readonly jwtService: JwtService,
  ) {}

  // ------------------- User -------------------
  async create(
    dto: CreateBankTransactionDto,
    files: Express.Multer.File[],
    req: CustomRequest,
  ) {
    const { userId, email } = req.user;

    if (!userId || !email) {
      throw new BadRequestException('Invalid token');
    }

    // 1. Get KYC
    const kyc = await this.kycRepo.findOne({ where: { email } });
    if (!kyc) {
      throw new BadRequestException('User KYC not found');
    }

    // 2. Check approved bank
    const approvedBank = await this.userBankRepo.findOne({
      where: { userId, status: 'Approved' },
    });

    if (!approvedBank) {
      throw new BadRequestException('No approved bank account found');
    }

    // 3. ReferenceId rules
    if (
      dto.transactionType === BankTransactionType.DEPOSIT &&
      !dto.referenceId
    ) {
      throw new BadRequestException('Reference ID is required for deposit');
    }

    if (dto.transactionType === BankTransactionType.DEPOSIT) {
      const existingTx = await this.bankTransactionRepo.findOne({
        where: { referenceId: dto.referenceId },
      });

      if (existingTx) {
        throw new BadRequestException('Duplicate reference ID');
      }
    }

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

    // 4. Create transaction
    const transaction = await this.bankTransactionRepo.save(
      this.bankTransactionRepo.create({
        userId,
        kycId: kyc.id,
        transactionType: dto.transactionType,
        amount: dto.amount,
        referenceId:
          dto.transactionType === BankTransactionType.DEPOSIT
            ? dto.referenceId
            : null,
        status: BankTransactionStatus.PENDING,
      }),
    );

    // 2️⃣ Upload documents using reusable function
    const documentUrls = await uploadFilesToAzure(
      files,
      `bank/${transaction.id}`,
    );

    // 3️⃣ Save relative paths to DB
    if (documentUrls.length) {
      await this.bankTransactionRepo.update(transaction.id, {
        documents: documentUrls,
      });
    }
    return {
      ...transaction,
      documentUrls,
    };
  }

  async listByUser(
    page = 1,
    limit = 10,
    req: CustomRequest,
    transactionType?: BankTransactionType,
  ) {
    const { userId } = req.user;
    if (!userId) throw new BadRequestException('Invalid token');

    const where: any = { userId };

    // Optional filter
    if (transactionType) {
      where.transactionType = transactionType;
    }

    const [data, total] = await this.bankTransactionRepo.findAndCount({
      where,
      relations: ['kyc'],
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

  // ------------------- Admin -------------------
  async listForAdmin(query: AdminBankTransactionQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: any = {};

    // 1️⃣ Filter by transaction status
    if (query.status && query.status !== BankTransactionStatusFilter.All) {
      where.status = query.status;
    }

    // 2️⃣ Filter by userType (via KYC)
    if (query.userType && query.userType !== UserTypeFilter.All) {
      const kycUsers = await this.kycRepo.find({
        select: ['id'],
        where: { accountType: query.userType },
      });

      const kycIds = kycUsers.map((u) => u.id);

      if (!kycIds.length) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }

      where.kycId = In(kycIds);
    }

    // 3️⃣ Fetch transactions
    const [transactions, total] = await this.bankTransactionRepo.findAndCount({
      where,
      relations: ['kyc'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // ✅ If no transactions, return early (avoids In([]) issues)
    if (!transactions.length) {
      return {
        data: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    // 4️⃣ Fetch banks for involved users
    const userIds = [...new Set(transactions.map((tx) => tx.userId))];

    const banks = await this.userBankRepo.find({
      where: {
        userId: In(userIds),
        // status: 'Approved',
      },
      order: { createdAt: 'DESC' },
    });

    // 5️⃣ Map latest bank per user
    const bankMap = new Map<number, any>();
    for (const bank of banks) {
      if (!bankMap.has(bank.userId)) {
        bankMap.set(bank.userId, {
          id: bank.id,
          accountName: bank.accountName,
          iban: bank.iban,
          status: bank.status,
        });
      }
    }

    // 6️⃣ Attach bank to each transaction
    const data = transactions.map((tx) => ({
      ...tx,
      bank: bankMap.get(tx.userId) ?? null,
    }));

    // ✅ Safe wallet fetch (never break API)
    let walletData: any = { items: [] };
    try {
      walletData = await this.walletService.getAllWallets();
    } catch (error) {
      console.error('Wallet service failed:', error?.message ?? error);
      // fallback: keep empty wallet list
    }

    // 7️⃣ Attach wallet + documents
    const withDocuments = data.map((transaction) => {
      const userId = transaction.userId;
      const creatorTag = `creator:${userId}`;

      const filteredWallets =
        walletData?.items?.filter(
          (w) => Array.isArray(w.tags) && w.tags.includes(creatorTag),
        ) ?? [];

      const walletAddress =
        filteredWallets.length > 0 ? filteredWallets[0].address : 'N/A';

      const documentPaths = transaction.documents || [];
      const documents = documentPaths.map((path) => {
        const fileName = path.split('/').pop();
        const url = getDocumentUrls(path)[0];
        return { fileName, url };
      });

      return {
        ...transaction,
        documents,
        walletAddress,
      };
    });

    return {
      data: withDocuments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateStatus(bankId: number, dto: UpdateBankTransactionStatusDto) {
    const bankTx = await this.bankTransactionRepo.findOne({
      where: { id: bankId },
    });

    if (!bankTx) {
      throw new NotFoundException('Bank transaction not found');
    }

    if (dto.status === BankTransactionStatus.APPROVED) {
      if (bankTx.status === BankTransactionStatus.APPROVED) {
        throw new BadRequestException('Approved transaction cannot be updated');
      }

      // If it's a WITHDRAW, automate fund transfer from User Wallet -> Admin Wallet
      if (bankTx.transactionType === BankTransactionType.WITHDRAW) {
        // 1. Get User's Wallet (Source)
        const userWallet = await this.walletRepo.findOne({
          where: { userId: bankTx.userId },
        });
        if (!userWallet?.walletId) {
          throw new BadRequestException('User wallet not found');
        }

        // 2. Get Admin's Wallet (Destination)
        const admin = await this.userRepo.findOne({
          where: { role: Role.ADMIN },
          relations: ['wallet'],
        });
        if (!admin?.wallet?.address) {
          throw new BadRequestException('Admin master wallet not found');
        }

        // 3. Execute Automated Transfer via DFNS
        // Note: Amount is in AED, sendAsset defaults to DDSC asset
        await this.walletService.sendAsset(
          {
            payload: {
              Amount: bankTx.amount.toString(),
              destination: { address: admin.wallet.address },
            },
          },
          userWallet.walletId,
        );
      }

      bankTx.status = dto.status;
    } else {
      bankTx.status = dto.status;
    }

    if (dto.reason) {
      bankTx.reason = dto.reason;
    }

    return this.bankTransactionRepo.save(bankTx);
  }

  // New method: count transactions by status
  async countByStatus(): Promise<Record<string, number>> {
    const statusKeyMap: Record<BankTransactionStatus, string> = {
      [BankTransactionStatus.PENDING]: 'pending',
      [BankTransactionStatus.APPROVED]: 'approved',
      [BankTransactionStatus.ON_HOLD]: 'onHold',
      [BankTransactionStatus.REJECTED]: 'rejected',
    };

    const result: Record<string, number> = {
      pending: 0,
      approved: 0,
      onHold: 0,
      rejected: 0,
    };

    for (const status of Object.values(BankTransactionStatus)) {
      const count = await this.bankTransactionRepo.count({
        where: { status },
      });

      const key = statusKeyMap[status];
      result[key] = count;
    }

    return result;
  }

  async download(body: AdminDownloadQueryDto) {
    const where: any = {};

    if (body.userType && !Object.values(UserTypeDTO).includes(body.userType)) {
      throw new BadRequestException('Invalid user type');
    }

    if (
      body.status &&
      !Object.values(BankTransactionStatusDTOs).includes(body.status)
    ) {
      throw new BadRequestException('Invalid Trasaction status');
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
    const transactions = await this.bankTransactionRepo.find({
      where,
      relations: ['kyc'],
      order: { createdAt: 'DESC' },
    });
    // 4️⃣ Fetch all approved banks for involved users (single query)
    const userIds = [...new Set(transactions.map((tx) => tx.userId))];

    const banks = await this.userBankRepo.find({
      where: {
        userId: In(userIds),
        // status: 'Approved',
      },
      order: { createdAt: 'DESC' },
    });

    // 5️⃣ Map latest approved bank per user
    const bankMap = new Map<number, any>();
    for (const bank of banks) {
      if (!bankMap.has(bank.userId)) {
        bankMap.set(bank.userId, {
          id: bank.id,
          accountName: bank.accountName,
          iban: bank.iban,
          status: bank.status,
        });
      }
    }

    // 6️⃣ Attach bank to each transaction
    const data = transactions.map((tx) => ({
      ...tx,
      bank: bankMap.get(tx.userId) ?? null,
    }));

    const walletData = await this.walletService.getAllWallets();

    // Map banks to include "documents" array of URLs
    const withDocuments = await Promise.all(
      data.map(async (transaction) => {
        // Filter wallets for this specific user
        const userId = transaction.userId; // depending on context
        const creatorTag = `creator:${userId}`;
        const filteredWallets = walletData.items.filter(
          (w) => Array.isArray(w.tags) && w.tags.includes(creatorTag),
        );
        // Get first wallet address or empty string
        const walletAddress = filteredWallets.length
          ? filteredWallets[0].address
          : '';

        // Map documents to include fileName and URL
        const documentPaths = transaction.documents || [];
        const documents = documentPaths.map((path) => {
          const fileName = path.split('/').pop(); // e.g., "1768304932802-iban.jpg"
          const url = getDocumentUrls(path)[0]; // assumes getDocumentUrls returns array of URLs
          return { fileName, url };
        });

        return {
          ...transaction,
          documents,
          walletAddress,
        };
      }),
    );

    return {
      data: withDocuments,
    };
  }

  async downloadPDF(body: AdminDownloadQueryDto, res: Response) {
    console.log('Generating PDF with body:', body);
    const { data }: any = await this.download(body);
    const rows = buildExportRows(data, transactionExportColumns);
    const headers = transactionExportColumns.map((c) => c.header);
    sendPDF(rows, headers, res, 'Transaction List', 'transactions.pdf');
  }

  async downloadCSV(body: AdminDownloadQueryDto, res: Response) {
    const { data }: any = await this.download(body);
    const rows = buildExportRows(data, transactionExportColumns);
    const headers = transactionExportColumns.map((c) => c.header);
    sendCSV(rows, headers, res, 'transactions.csv');
  }
}
