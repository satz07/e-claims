export enum DonationPaymentSource {
  WALLET = 'WALLET',
  FIAT = 'FIAT',
}

/**
 * Simplified donation lifecycle.
 *
 * INITIATED   — DB record created, transfer not yet confirmed on-chain
 * TRANSFERRED — Crypto confirmed in admin master wallet (donor's obligation complete)
 * DISBURSED   — Batch-applied when a milestone disbursement runs
 * FAILED      — Transfer to admin wallet failed
 * CANCELLED   — Donor cancelled before transfer completed
 *
 * Note: Admin review, approval, and milestone verification live on the
 * Milestone entity state machine — not here.
 */
export enum DonationStep {
  INITIATED = 'INITIATED',
  TRANSFERRED = 'TRANSFERRED',
  DISBURSED = 'DISBURSED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface DonationStepEntry {
  fromStep: DonationStep | null;
  toStep: DonationStep;
  at: string; // ISO timestamp
  triggeredBy: number | null; // userId or null for system
  reason?: string; // required for FAILED / CANCELLED
  metadata?: Record<string, any>;
}
