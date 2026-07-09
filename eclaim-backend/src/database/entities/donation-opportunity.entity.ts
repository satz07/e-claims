import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Campaign } from './campaign.entity';

import {
  OpportunitySector,
  PriorityLevel,
  OpportunityApprovalStatus,
  CampaignRequestStatus,
} from './enums';

@Entity('donation_opportunities')
export class DonationOpportunity {
  @PrimaryGeneratedColumn()
  id: number;

  // --- Opportunity fields ---

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  targetAmount: number;

  @Column({ type: 'enum', enum: OpportunitySector })
  sector: OpportunitySector;

  @Column({ type: 'enum', enum: PriorityLevel, default: PriorityLevel.MEDIUM })
  priorityLevel: PriorityLevel;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'text' })
  targetOutcome: string;

  @Column({ type: 'text', nullable: true })
  expectedBeneficiaries: string | null;

  // FK to implementation partner — references the organizations/users table
  // Left as a plain column since the target entity is TBD
  @Index()
  @Column({ nullable: true })
  implementationPartnerId: number | null;

  // --- Approval Lifecycle ---

  @Column({
    type: 'enum',
    enum: OpportunityApprovalStatus,
    default: OpportunityApprovalStatus.DRAFT,
  })
  status: OpportunityApprovalStatus;

  @Column({ type: 'text', nullable: true })
  statusReason: string | null;

  // --- Campaign Association ---

  @Index()
  @Column()
  campaignId: number;

  @ManyToOne(() => Campaign, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'campaignId' })
  campaign: Campaign;

  @Column({
    type: 'enum',
    enum: CampaignRequestStatus,
    default: CampaignRequestStatus.NONE,
  })
  campaignRequestStatus: CampaignRequestStatus;

  // --- Timestamps ---

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
