import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './users.entity';

@Entity('user_two_factor')
@Index(['userId'], { unique: true })
export class UserTwoFactor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @OneToOne(() => User, (u) => u.twoFactor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  // email OTP for login second step
  @Column({ type: 'text', nullable: true })
  emailOtpCode: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailOtpSentAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  emailOtpExpiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
