import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserKyc } from './user-kyc.entity';
import { DonationOpportunity } from './donation-opportunity.entity';

// Who handled the transfer
export enum PaymentProvider {
  LEAN = 'LEAN',
  FAB = 'FAB',
  MANUAL = 'MANUAL',
  DFNS = 'DFNS', // DFNS crypto wallet transfers
}

// Direction of money
export enum TransferDirection {
  IN = 'IN',
  OUT = 'OUT',
}

// High level type
export enum TransferType {
  BANK_TOPUP = 'BANK_TOPUP',
  BANK_TRANSFER = 'BANK_TRANSFER',
  WITHDRAWAL = 'WITHDRAWAL',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
  DONATION = 'DONATION',
}

// Status (normalized for all providers)
export enum TransferStatus {
  INITIATED = 'INITIATED',
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
  CANCELLED = 'CANCELLED',
}

// ✅ STRICT Payment Methods
export enum PaymentMethod {
  // ---- LEAN ----
  LEAN_OPEN_BANKING = 'LEAN_OPEN_BANKING',
  LEAN_BANK_TRANSFER = 'LEAN_BANK_TRANSFER',
  LEAN_CARD = 'LEAN_CARD',

  // ---- FAB ----
  FAB_LOCAL_TRANSFER = 'FAB_LOCAL_TRANSFER',
  FAB_INTERNAL_TRANSFER = 'FAB_INTERNAL_TRANSFER',
  FAB_SWIFT = 'FAB_SWIFT',

  // ---- System ----
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',

  // ---- DFNS Crypto ----
  DFNS_CRYPTO_TRANSFER = 'DFNS_CRYPTO_TRANSFER', // Admin master wallet → business wallet
}

@Entity('transfer_history')
@Index(['kycId', 'direction', 'occurredAt'])
@Index(['userId', 'occurredAt'])
@Index(['provider', 'providerReference'], { unique: true })
export class TransferHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: string;

  @Index()
  @Column()
  kycId: number;

  @ManyToOne(() => UserKyc, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kycId' })
  kyc: UserKyc;

  @Index()
  @Column({ nullable: true })
  opportunityId: number | null;

  @ManyToOne(() => DonationOpportunity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'opportunityId' })
  opportunity: DonationOpportunity | null;

  // Provider
  @Column({ type: 'enum', enum: PaymentProvider })
  provider: PaymentProvider;

  // STRICT METHOD
  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({ type: 'enum', enum: TransferDirection })
  direction: TransferDirection;

  @Column({ type: 'enum', enum: TransferType })
  type: TransferType;

  @Column({
    type: 'enum',
    enum: TransferStatus,
    default: TransferStatus.INITIATED,
  })
  status: TransferStatus;

  // Money
  @Column({ type: 'bigint' })
  amountMinor: string;

  @Column({ default: 2 })
  currencyDecimals: number;

  @Column({ length: 8 })
  currency: string;

  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  // Idempotency
  @Column()
  providerReference: string;

  @Column({ nullable: true })
  internalReference?: string;

  // Bank Info
  @Column({ nullable: true })
  sourceIban?: string;

  @Column({ nullable: true })
  destinationIban?: string;

  @Column({ nullable: true })
  counterpartyName?: string;

  @Column({ nullable: true })
  counterpartyBank?: string;

  @Column({ type: 'text', nullable: true })
  failureReason?: string;

  @Column({ type: 'jsonb', nullable: true })
  providerPayload?: any;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
