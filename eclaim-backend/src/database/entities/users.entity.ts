import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { UserPasskey } from './user-passkey.entity';
import { UserTwoFactor } from './user-two-factor.entity';
import { UserKeycloak } from './userkeycloak.entity';
import { UserDtps } from './user-dtps.entity';
import { Wallet } from './wallet.entity';

export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password: string;

  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role: Role;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ nullable: true })
  emailVerifyCode: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  emailVerifyCodeSentAt: Date | null;

  @Column({ nullable: true, type: 'text' })
  currentChallenge: string | null;

  @OneToMany(() => UserPasskey, (p) => p.user, { cascade: true })
  passkeys: UserPasskey[];

  @OneToOne(() => UserKeycloak, (k) => k.user)
  keycloak: UserKeycloak;

  @OneToOne(() => UserTwoFactor, (t) => t.user, { cascade: true })
  twoFactor: UserTwoFactor;

  @OneToOne(() => UserDtps, (dtps) => dtps.user, { cascade: true })
  dtps: UserDtps;

  @OneToOne(() => Wallet, (wallet) => wallet.user, { cascade: true })
  wallet: Wallet;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
