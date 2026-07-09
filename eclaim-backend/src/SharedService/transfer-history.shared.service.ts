// src/common/services/shared-transfer-history-db.service.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  CreateTransferHistoryPayload,
  TransferStatus,
} from './dto/transfer-history.dto';
import { TransferHistory } from 'src/database/entities/transfer-history.entity';

@Injectable()
export class SharedTransferHistoryDbService {
  private readonly logger = new Logger(SharedTransferHistoryDbService.name);

  constructor(
    @InjectRepository(TransferHistory)
    private readonly transferHistoryRepo: Repository<TransferHistory>,
  ) {}

  async upsertTransferHistory(payload: CreateTransferHistoryPayload) {
    try {
      // -------------------------------
      // 1️⃣ Basic Validation
      // -------------------------------
      if (!payload?.provider || !payload?.providerReference) {
        throw new BadRequestException(
          'provider and providerReference are required',
        );
      }

      if (!payload?.userId || !payload?.kycId) {
        throw new BadRequestException('userId and kycId are required');
      }

      if (!payload?.amountMinor || !payload?.currency) {
        throw new BadRequestException('amountMinor and currency are required');
      }

      // -------------------------------
      // 2️⃣ Normalize Date
      // -------------------------------
      const occurredAt =
        payload.occurredAt instanceof Date
          ? payload.occurredAt
          : new Date(payload.occurredAt);

      if (isNaN(occurredAt.getTime())) {
        throw new BadRequestException('Invalid occurredAt date');
      }

      // -------------------------------
      // 3️⃣ Check Existing
      // -------------------------------
      const existing = await this.transferHistoryRepo.findOne({
        where: {
          provider: payload.provider as any,
          providerReference: payload.providerReference,
        },
      });

      // -------------------------------
      // 4️⃣ Insert
      // -------------------------------
      if (!existing) {
        const entity = this.transferHistoryRepo.create({
          userId: payload.userId,
          kycId: payload.kycId,

          provider: payload.provider as any,
          paymentMethod: payload.paymentMethod as any,

          direction: payload.direction as any,
          type: payload.type as any,
          status: payload.status as any,

          amountMinor: payload.amountMinor,
          currency: payload.currency,
          currencyDecimals: payload.currencyDecimals ?? 2,

          occurredAt,

          providerReference: payload.providerReference,
          internalReference: payload.internalReference ?? null,

          sourceIban: payload.sourceIban ?? null,
          destinationIban: payload.destinationIban ?? null,
          counterpartyName: payload.counterpartyName ?? null,
          counterpartyBank: payload.counterpartyBank ?? null,

          failureReason: payload.failureReason ?? null,
          providerPayload: payload.providerPayload ?? null,
        });

        return await this.transferHistoryRepo.save(entity);
      }

      // -------------------------------
      // 5️⃣ Update (Idempotent Safe)
      // -------------------------------

      const shouldUpdateStatus =
        existing.status !== TransferStatus.SUCCESS ||
        payload.status === TransferStatus.SUCCESS;

      existing.paymentMethod =
        (payload.paymentMethod as any) ?? existing.paymentMethod;

      existing.direction = (payload.direction as any) ?? existing.direction;

      existing.type = (payload.type as any) ?? existing.type;

      if (shouldUpdateStatus) {
        existing.status = payload.status as any;
      }

      existing.amountMinor = payload.amountMinor ?? existing.amountMinor;

      existing.currency = payload.currency ?? existing.currency;

      existing.currencyDecimals =
        payload.currencyDecimals ?? existing.currencyDecimals;

      existing.occurredAt = occurredAt;

      existing.internalReference =
        payload.internalReference ?? existing.internalReference;

      existing.sourceIban = payload.sourceIban ?? existing.sourceIban;

      existing.destinationIban =
        payload.destinationIban ?? existing.destinationIban;

      existing.counterpartyName =
        payload.counterpartyName ?? existing.counterpartyName;

      existing.counterpartyBank =
        payload.counterpartyBank ?? existing.counterpartyBank;

      existing.failureReason = payload.failureReason ?? existing.failureReason;

      existing.providerPayload =
        payload.providerPayload ?? existing.providerPayload;

      return await this.transferHistoryRepo.save(existing);
    } catch (error) {
      // -------------------------------
      // 6️⃣ Handle Unique Race Condition
      // -------------------------------
      if (error instanceof QueryFailedError) {
        const err: any = error;

        // Postgres unique violation
        if (err.code === '23505') {
          this.logger.warn(
            `Duplicate transfer detected for ${payload.provider} - ${payload.providerReference}`,
          );

          // Retry fetch (another process inserted it)
          return this.transferHistoryRepo.findOne({
            where: {
              provider: payload.provider as any,
              providerReference: payload.providerReference,
            },
          });
        }
      }

      // -------------------------------
      // 7️⃣ Log Unexpected Error
      // -------------------------------
      this.logger.error(`TransferHistory upsert failed`, error?.stack || error);

      throw new InternalServerErrorException(
        'Failed to upsert transfer history',
      );
    }
  }

  /**
   * ✅ Simple create (non-idempotent) if you ever need it.
   * Prefer upsertTransferHistory in webhook-style flows.
   */
  async createTransferHistory(payload: CreateTransferHistoryPayload) {
    const occurredAt =
      payload.occurredAt instanceof Date
        ? payload.occurredAt
        : new Date(payload.occurredAt);

    const entity = this.transferHistoryRepo.create({
      ...payload,
      occurredAt,
      currencyDecimals: payload.currencyDecimals ?? 2,
    } as any);

    return this.transferHistoryRepo.save(entity);
  }
}
