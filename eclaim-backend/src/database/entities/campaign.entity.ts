import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  OpportunitySector,
  PriorityLevel,
  OpportunityApprovalStatus,
} from './enums';

export interface CampaignInfoItem {
  title: string;
  desc: string;
}

export interface TimelineItem {
  date: string;
  state: string;
}

export interface CampaignCycle {
  cycleNumber: number;
  state: string;
  timeline: TimelineItem[];
  orgsToFund: number;
  minAmount: number;
  maxAmount: number;
  totalAmount: number;
}

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  refCode: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar', nullable: true })
  logoUrl: string | null;

  // --- Global Financials ---

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  globalTotal: number;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  globalMin: number;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  globalMax: number;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  // --- Impact & Metrics ---

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  beneficiaries: number | null;

  @Column({ type: 'text', nullable: true })
  targetOutcome: string | null;

  @Column({ type: 'date', nullable: true })
  startDate: string | null;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  // --- Status & Classification ---

  @Column({
    type: 'enum',
    enum: OpportunityApprovalStatus,
    default: OpportunityApprovalStatus.DRAFT,
  })
  status: OpportunityApprovalStatus;

  @Column({ type: 'enum', enum: PriorityLevel, default: PriorityLevel.MEDIUM })
  priority: PriorityLevel;

  @Column({ type: 'enum', enum: OpportunitySector, nullable: true })
  sector: OpportunitySector | null;

  @Column({ type: 'varchar', nullable: true })
  partner: string | null;

  // --- Content Blocks ---

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true })
  fullDescription: string | null;

  @Column({ type: 'jsonb', nullable: true })
  grantOverview: CampaignInfoItem[] | null;

  @Column({ type: 'jsonb', nullable: true })
  evalCriteria: CampaignInfoItem[] | null;

  @Column({ type: 'jsonb', nullable: true })
  selCriteria: CampaignInfoItem[] | null;

  @Column({ type: 'jsonb', nullable: true })
  cycles: CampaignCycle[] | null;

  // --- Timestamps ---

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
