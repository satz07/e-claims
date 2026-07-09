import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { DonationOpportunity } from './donation-opportunity.entity';

@Entity('project_plans')
export class ProjectPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  opportunityId: number;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'text' })
  targetOutcome: string;

  @Column({ type: 'text', nullable: true })
  expectedBeneficiaries: string | null;

  @Column({ type: 'text', nullable: true })
  brief: string | null;

  // --- Relations ---

  @OneToOne(() => DonationOpportunity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'opportunityId' })
  opportunity: DonationOpportunity;

  // --- Timestamps ---

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
