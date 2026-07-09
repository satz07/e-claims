// bank-transaction.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { UserKyc } from './user-kyc.entity';
import { User } from './users.entity';
// src/modules/bank-transaction/bank-transaction.enum.ts

export enum BankTransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
}

export enum BankTransactionStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  ON_HOLD = 'OnHold',
  REJECTED = 'Rejected',
}

@Entity('bank_transactions')
export class BankTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: BankTransactionType,
  })
  transactionType: BankTransactionType;

  @Column('decimal', { precision: 20, scale: 2 })
  amount: number;

  @Column({ nullable: true })
  referenceId?: string;

  @Column({
    type: 'enum',
    enum: BankTransactionStatus,
    default: BankTransactionStatus.PENDING,
  })
  status: BankTransactionStatus;

  @Column({ nullable: true })
  reason?: string;

  @Column()
  kycId: number;

  @ManyToOne(() => UserKyc, (kyc) => kyc.id)
  kyc: UserKyc;

  @Column({ type: 'jsonb', nullable: true })
  documents?: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
