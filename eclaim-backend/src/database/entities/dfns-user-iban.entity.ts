import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserKyc } from './user-kyc.entity';
import { User } from './users.entity';

@Entity('user_ibans')
@Unique(['userId', 'walletAddress'])
export class UserIban {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // 🔗 FK → user_kyc.id
  @Index()
  @Column()
  kycId: number;

  @ManyToOne(() => UserKyc, (kyc) => kyc.ibans, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'kycId' })
  kyc: UserKyc;

  @Column()
  accountName: string;

  @Column()
  walletAddress: string;

  @Column({ nullable: true })
  nickname?: string;

  @CreateDateColumn()
  createdAt: Date;
}
