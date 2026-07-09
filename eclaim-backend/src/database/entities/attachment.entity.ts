import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AttachmentOwnerType {
  OPPORTUNITY = 'opportunity',
  PROJECT_PLAN = 'project_plan',
  MILESTONE = 'milestone',
}

export enum AttachmentType {
  DOCUMENT = 'document', // project-level documents
  PROOF = 'proof', // milestone proof
  SPENDING = 'spending', // milestone spending record
  REPORT = 'report', // milestone report
  BANNER = 'banner', // opportunity banner
}

@Entity('attachments')
@Index(['ownerId', 'ownerType'])
export class Attachment {
  @PrimaryGeneratedColumn()
  id: number;

  // Polymorphic owner — no DB-level FK, enforced at application layer
  @Column({ nullable: true })
  ownerId: number | null;

  @Column({ type: 'enum', enum: AttachmentOwnerType })
  ownerType: AttachmentOwnerType;

  @Column({ type: 'enum', enum: AttachmentType })
  type: AttachmentType;

  @Column({ type: 'text' })
  fileUrl: string;

  @Column({ type: 'varchar', nullable: true })
  fileName: string | null;

  // FK to users.id — who uploaded this file
  @Column({ nullable: true })
  uploadedBy: number | null;

  // --- Timestamps ---

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
