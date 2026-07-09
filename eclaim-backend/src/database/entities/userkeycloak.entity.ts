import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './users.entity';

export enum KeycloakProvisionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('user_keycloak')
export class UserKeycloak {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  userId: number;

  @OneToOne(() => User, (user) => user.keycloak, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true, unique: true })
  keycloakUserId: string | null;

  @Column({
    type: 'enum',
    enum: KeycloakProvisionStatus,
    default: KeycloakProvisionStatus.PENDING,
  })
  provisionStatus: KeycloakProvisionStatus;

  @Column({ nullable: true, type: 'text' })
  errorMessage: string | null;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ nullable: true, type: 'timestamp' })
  provisionedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
