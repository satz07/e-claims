// src/modules/user-bank/user-bank.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { UserKyc } from './user-kyc.entity';
import { User } from './users.entity';

export type BankStatus = 'Pending' | 'Approved' | 'OnHold' | 'Rejected';

@Entity('user_banks')
@Unique(['userId', 'iban']) // Unique IBAN per user
export class UserBank {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  kycId: number;

  @ManyToOne(() => UserKyc, (kyc) => kyc.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kycId' })
  kyc: UserKyc;

  @Column()
  accountName: string;

  @Column()
  iban: string;

  @Column({ default: 'Pending' })
  status: BankStatus;

  @Column({ nullable: true })
  reason?: string; // Reason if Rejected/OnHold

  @Column({ type: 'jsonb', nullable: true })
  documents?: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
