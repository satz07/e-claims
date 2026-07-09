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
import { User } from './users.entity';
import { Campaign } from './campaign.entity';
import { DonationOpportunity } from './donation-opportunity.entity';
import { Beneficiary } from './beneficiary.entity';
import { Milestone } from './milestone.entity';
import {
  DonationPaymentSource,
  DonationStep,
  DonationStepEntry,
} from './donation.enums';

@Entity('donations')
export class Donations {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  donorId: number;

  @Column({ nullable: true })
  walletId: string | null;

  @Column({ nullable: true })
  transactionId: string | null;

  @Index()
  @Column({ nullable: true })
  campaignId: number | null;

  @Index()
  @Column()
  opportunityId: number;

  @Index()
  @Column({ nullable: true })
  beneficiaryId: number | null;

  @Index()
  @Column({ nullable: true })
  milestoneId: number | null;

  @Column({ type: 'bigint' })
  amountMinor: string;

  @Column({ length: 8 })
  currency: string;

  // --- Donation Lifecycle ---

  @Column({
    type: 'enum',
    enum: DonationPaymentSource,
  })
  paymentSource: DonationPaymentSource;

  @Index()
  @Column({
    type: 'enum',
    enum: DonationStep,
    default: DonationStep.INITIATED,
  })
  donationStep: DonationStep;

  // FK → disbursements.id — set when a milestone disbursement batch includes this donation
  @Column({ nullable: true })
  disbursementId: number | null;

  // --- Failure / Audit ---

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ type: 'jsonb', default: '[]' })
  stepHistory: DonationStepEntry[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'timestamptz' })
  donatedAt: Date;

  // --- Relations ---

  @ManyToOne(() => User)
  @JoinColumn({ name: 'donorId' })
  donor: User;

  @ManyToOne(() => Campaign)
  @JoinColumn({ name: 'campaignId' })
  campaign: Campaign;

  @ManyToOne(() => DonationOpportunity)
  @JoinColumn({ name: 'opportunityId' })
  opportunity: DonationOpportunity;

  @ManyToOne(() => Beneficiary, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'beneficiaryId' })
  beneficiary: Beneficiary;

  @ManyToOne(() => Milestone, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'milestoneId' })
  milestone: Milestone;

  // --- Timestamps ---

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
