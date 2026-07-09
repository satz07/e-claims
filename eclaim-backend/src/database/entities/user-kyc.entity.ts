// user-kyc.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { UserIban } from './dfns-user-iban.entity';
import { UserDtps } from './user-dtps.entity';
import { Wallet } from './wallet.entity';

export type KycReviewStatus =
  | 'Init'
  | 'Incomplete'
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'FinallyRejected';

@Entity('user_kyc')
export class UserKyc {
  @PrimaryGeneratedColumn()
  id: number;

  // Email can be null, but must be unique when set
  @Index('UQ_user_kyc_email', { unique: true, where: '"email" IS NOT NULL' })
  @Column({ type: 'varchar', nullable: true })
  email?: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true })
  accountType?: 'Individual' | 'Business';

  @Column({ nullable: true })
  applicantId?: string;

  @Column({ default: 'Init' })
  reviewStatus: KycReviewStatus;

  @Column({ nullable: true })
  levelName?: string;

  @Column({ nullable: true })
  userIdForSumsub?: string;

  @OneToMany(() => UserIban, (iban) => iban.kyc)
  ibans: UserIban[];

  @OneToOne(() => UserDtps, (dtps) => dtps.kyc, { cascade: true })
  dtps: UserDtps;

  @OneToOne(() => Wallet, (wallet) => wallet.kyc, { cascade: true })
  wallet: Wallet;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
