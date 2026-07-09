import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DonationOpportunity } from './donation-opportunity.entity';
import { Milestone } from './milestone.entity';

export enum DisbursementStatus {
  PENDING = 'PENDING', // Created, DFNS call not yet executed
  SUCCESS = 'SUCCESS', // DFNS tx confirmed
  FAILED = 'FAILED', // DFNS tx failed — donations remain TRANSFERRED
}

/**
 * One Disbursement record is created per milestone payout.
 * It represents the single DFNS transaction from the admin master wallet
 * to the business wallet, aggregating all TRANSFERRED donations for that milestone.
 *
 * Donations linked to this disbursement are batch-updated to DonationStep.DISBURSED.
 */
@Entity('disbursements')
@Index(['opportunityId', 'milestoneId'], { unique: true }) // one payout per milestone
export class Disbursement {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  opportunityId: number;

  @Index()
  @Column()
  milestoneId: number;

  @Column()
  disbursedBy: number; // Admin user ID who triggered the disbursement

  // Aggregated total of all linked donations
  @Column({ type: 'bigint' })
  totalAmountMinor: string;

  @Column({ length: 8 })
  currency: string;

  @Column({ default: 18 })
  currencyDecimals: number;

  // DFNS transaction ID returned after the on-chain transfer
  @Column({ nullable: true })
  dfnsTransactionId: string | null;

  // Business wallet that received the funds
  @Column({ nullable: true })
  recipientWalletId: string | null;

  @Column({ nullable: true })
  recipientWalletAddress: string | null;

  @Column({
    type: 'enum',
    enum: DisbursementStatus,
    default: DisbursementStatus.PENDING,
  })
  status: DisbursementStatus;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  // Full DFNS response payload for auditing
  @Column({ type: 'jsonb', nullable: true })
  dfnsPayload: any;

  // Number of donation records included in this batch
  @Column({ default: 0 })
  donationCount: number;

  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  // --- Relations ---

  @ManyToOne(() => DonationOpportunity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'opportunityId' })
  opportunity: DonationOpportunity;

  @ManyToOne(() => Milestone, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'milestoneId' })
  milestone: Milestone;

  // --- Timestamps ---

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
