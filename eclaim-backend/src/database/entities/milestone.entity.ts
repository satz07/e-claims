import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { Beneficiary } from './beneficiary.entity';

export enum MilestoneStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  PROOF_SUBMITTED = 'proof_submitted', // Business user submitted proof documents
  PROOF_REJECTED = 'proof_rejected', // Admin rejected the proof
  COMPLETED = 'completed', // Admin approved proof
  DISBURSED = 'disbursed', // Funds paid out to business wallet
}

@Entity('milestones')
@Check('"progress" >= 0 AND "progress" <= 100')
export class Milestone {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  beneficiaryId: number;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'smallint', default: 0 })
  progress: number;

  @Column({
    type: 'enum',
    enum: MilestoneStatus,
    default: MilestoneStatus.PENDING,
  })
  status: MilestoneStatus;

  // --- Proof Submission (Business User) ---

  @Column({ type: 'jsonb', nullable: true })
  proofDocuments: { url: string; label: string; submittedAt: string }[] | null;

  @Column({ type: 'timestamptz', nullable: true })
  proofSubmittedAt: Date | null;

  @Column({ nullable: true })
  proofSubmittedBy: number | null;

  @Column({ type: 'text', nullable: true })
  proofRejectionReason: string | null;

  // --- Disbursement (Admin) ---

  @Column({ nullable: true })
  disbursementId: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  disbursedAt: Date | null;

  @Column({ nullable: true })
  disbursedBy: number | null;

  // --- Relations ---

  @ManyToOne(() => Beneficiary, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'beneficiaryId' })
  beneficiary: Beneficiary;

  // --- Timestamps ---

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
