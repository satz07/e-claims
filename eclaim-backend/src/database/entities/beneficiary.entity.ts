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
import { ProjectPlan } from './project-plan.entity';

@Entity('beneficiaries')
export class Beneficiary {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  projectPlanId: number;

  @Column({ type: 'varchar' })
  name: string;

  // --- Relations ---

  @ManyToOne(() => ProjectPlan, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectPlanId' })
  projectPlan: ProjectPlan;

  // --- Timestamps ---

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
