import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './users.entity';

@Entity('user_passkeys')
@Index(['userId', 'credentialId'], { unique: true })
export class UserPasskey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, (u) => u.passkeys, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // WebAuthn credential id (Base64URLString)
  @Column({ type: 'text' })
  credentialId: string;

  // Stored as base64url string (encode the Uint8Array publicKey)
  @Column({ type: 'text' })
  publicKey: string;

  @Column({ type: 'int', default: 0 })
  counter: number;

  @Column({ type: 'json', nullable: true })
  transports?: string[]; // ['internal', 'hybrid', ...] if provided by client

  @Column({ type: 'text', nullable: true })
  deviceType?: string; // 'singleDevice' | 'multiDevice' (optional)

  @Column({ type: 'boolean', nullable: true })
  backedUp?: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
