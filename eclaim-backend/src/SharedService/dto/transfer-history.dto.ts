// src/common/services/dto/transfer-history.dto.ts

export enum PaymentProvider {
  LEAN = 'LEAN',
  FAB = 'FAB',
  MANUAL = 'MANUAL',
  DFNS = 'DFNS', // DFNS crypto wallet transfers
}

export enum PaymentMethod {
  LEAN_OPEN_BANKING = 'LEAN_OPEN_BANKING',
  LEAN_BANK_TRANSFER = 'LEAN_BANK_TRANSFER',
  LEAN_CARD = 'LEAN_CARD',

  FAB_LOCAL_TRANSFER = 'FAB_LOCAL_TRANSFER',
  FAB_INTERNAL_TRANSFER = 'FAB_INTERNAL_TRANSFER',
  FAB_SWIFT = 'FAB_SWIFT',

  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',

  // DFNS Crypto
  DFNS_CRYPTO_TRANSFER = 'DFNS_CRYPTO_TRANSFER',
}

export enum TransferDirection {
  IN = 'IN',
  OUT = 'OUT',
}

export enum TransferType {
  BANK_TOPUP = 'BANK_TOPUP',
  BANK_TRANSFER = 'BANK_TRANSFER',
  WITHDRAWAL = 'WITHDRAWAL',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum TransferStatus {
  INITIATED = 'INITIATED',
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
  CANCELLED = 'CANCELLED',
}

export type CreateTransferHistoryPayload = {
  userId: string;
  kycId: number;

  provider: PaymentProvider;
  paymentMethod: PaymentMethod;

  direction: TransferDirection;
  type: TransferType;
  status: TransferStatus;

  amountMinor: string; // bigint as string
  currency: string;
  currencyDecimals?: number;

  occurredAt: string | Date;

  providerReference: string;
  internalReference?: string;

  sourceIban?: string;
  destinationIban?: string;

  counterpartyName?: string;
  counterpartyBank?: string;

  failureReason?: string;
  providerPayload?: any;
};
