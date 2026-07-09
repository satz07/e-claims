import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { UserKyc } from './user-kyc.entity';
import { User } from './users.entity';

@Entity('user_dtps')
export class UserDtps {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  dtpsUserId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ unique: true })
  userId: number;

  @OneToOne(() => UserKyc, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kycId' })
  kyc: UserKyc;

  @Column({ unique: true })
  kycId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
