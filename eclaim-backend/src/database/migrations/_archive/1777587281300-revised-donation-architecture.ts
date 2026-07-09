import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Revised Donation Architecture
 *
 * PostgreSQL restriction: ALTER TYPE ... ADD VALUE cannot be used in the same
 * transaction as queries that reference the new value.
 * Solution: commit after each ADD VALUE, then open a new transaction.
 */
export class RevisedDonationArchitecture1777587281300
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Phase 1: ADD enum values (each needs its own committed transaction) ───
    // Commit the outer TypeORM transaction so ADD VALUE is visible immediately.

    await queryRunner.commitTransaction();

    // DonationStep — new value TRANSFERRED (may already exist from 1777489599350)
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'donations_donationstep_enum'
            AND e.enumlabel = 'TRANSFERRED'
        ) THEN
          ALTER TYPE "donations_donationstep_enum" ADD VALUE 'TRANSFERRED';
        END IF;
      END $$;
    `);

    // MilestoneStatus
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'milestones_status_enum' AND e.enumlabel = 'proof_submitted'
        ) THEN ALTER TYPE "milestones_status_enum" ADD VALUE 'proof_submitted'; END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'milestones_status_enum' AND e.enumlabel = 'proof_rejected'
        ) THEN ALTER TYPE "milestones_status_enum" ADD VALUE 'proof_rejected'; END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'milestones_status_enum' AND e.enumlabel = 'disbursed'
        ) THEN ALTER TYPE "milestones_status_enum" ADD VALUE 'disbursed'; END IF;
      END $$;
    `);

    // OpportunityApprovalStatus
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'donation_opportunities_status_enum' AND e.enumlabel = 'ACTIVE'
        ) THEN ALTER TYPE "donation_opportunities_status_enum" ADD VALUE 'ACTIVE'; END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'donation_opportunities_status_enum' AND e.enumlabel = 'COMPLETED'
        ) THEN ALTER TYPE "donation_opportunities_status_enum" ADD VALUE 'COMPLETED'; END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'donation_opportunities_status_enum' AND e.enumlabel = 'EXPIRED'
        ) THEN ALTER TYPE "donation_opportunities_status_enum" ADD VALUE 'EXPIRED'; END IF;
      END $$;
    `);

    // transfer_history enums
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'transfer_history_provider_enum' AND e.enumlabel = 'DFNS'
        ) THEN ALTER TYPE "transfer_history_provider_enum" ADD VALUE 'DFNS'; END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'transfer_history_paymentmethod_enum' AND e.enumlabel = 'DFNS_CRYPTO_TRANSFER'
        ) THEN ALTER TYPE "transfer_history_paymentmethod_enum" ADD VALUE 'DFNS_CRYPTO_TRANSFER'; END IF;
      END $$;
    `);

    // ── Phase 2: DDL + DML — now in a fresh transaction ───────────────────────
    await queryRunner.startTransaction();

    // donations_paymentsource_enum + paymentSource column
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'donations_paymentsource_enum'
        ) THEN
          CREATE TYPE "public"."donations_paymentsource_enum" AS ENUM('WALLET', 'FIAT');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE donations
        ADD COLUMN IF NOT EXISTS "paymentSource" "public"."donations_paymentsource_enum"
    `);

    // donations_donationstep_enum + donationStep column
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'donations_donationstep_enum'
        ) THEN
          CREATE TYPE "public"."donations_donationstep_enum"
            AS ENUM('INITIATED', 'TRANSFERRED', 'DISBURSED', 'FAILED', 'CANCELLED');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE donations
        ADD COLUMN IF NOT EXISTS "donationStep"
          "public"."donations_donationstep_enum" NOT NULL DEFAULT 'INITIATED'
    `);

    // Other donation columns
    await queryRunner.query(`
      ALTER TABLE donations
        ADD COLUMN IF NOT EXISTS "failureReason" TEXT,
        ADD COLUMN IF NOT EXISTS "stepHistory"   JSONB NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "metadata"      JSONB
    `);

    // Data migration: map old steps → new states
    await queryRunner.query(`
      UPDATE donations SET "donationStep" = 'TRANSFERRED'::donations_donationstep_enum
      WHERE "donationStep"::text IN ('ESCROWED', 'ADMIN_REVIEW', 'ADMIN_APPROVED', 'DISBURSING')
    `);
    await queryRunner.query(`
      UPDATE donations SET "donationStep" = 'INITIATED'::donations_donationstep_enum
      WHERE "donationStep"::text = 'ESCROW_PENDING'
    `);
    await queryRunner.query(`
      UPDATE donations SET "donationStep" = 'FAILED'::donations_donationstep_enum
      WHERE "donationStep"::text = 'ADMIN_REJECTED'
    `);

    // milestones — proof and disbursement columns
    await queryRunner.query(`
      ALTER TABLE milestones
        ADD COLUMN IF NOT EXISTS "proofDocuments"       JSONB,
        ADD COLUMN IF NOT EXISTS "proofSubmittedAt"     TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "proofSubmittedBy"     INTEGER,
        ADD COLUMN IF NOT EXISTS "proofRejectionReason" TEXT,
        ADD COLUMN IF NOT EXISTS "disbursementId"       INTEGER,
        ADD COLUMN IF NOT EXISTS "disbursedAt"          TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "disbursedBy"          INTEGER
    `);

    // disbursements table
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'disbursement_status_enum'
        ) THEN
          CREATE TYPE "disbursement_status_enum" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS disbursements (
        id                       SERIAL PRIMARY KEY,
        "opportunityId"          INTEGER NOT NULL,
        "milestoneId"            INTEGER NOT NULL,
        "disbursedBy"            INTEGER NOT NULL,
        "totalAmountMinor"       BIGINT NOT NULL,
        currency                 VARCHAR(8) NOT NULL,
        "currencyDecimals"       INTEGER NOT NULL DEFAULT 18,
        "dfnsTransactionId"      VARCHAR,
        "recipientWalletId"      VARCHAR,
        "recipientWalletAddress" VARCHAR,
        status                   "disbursement_status_enum" NOT NULL DEFAULT 'PENDING',
        "failureReason"          TEXT,
        "dfnsPayload"            JSONB,
        "donationCount"          INTEGER NOT NULL DEFAULT 0,
        "occurredAt"             TIMESTAMPTZ NOT NULL,
        "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "UQ_disbursements_milestone" UNIQUE ("opportunityId", "milestoneId"),
        CONSTRAINT "FK_disbursements_opportunity" FOREIGN KEY ("opportunityId")
          REFERENCES donation_opportunities(id) ON DELETE RESTRICT,
        CONSTRAINT "FK_disbursements_milestone" FOREIGN KEY ("milestoneId")
          REFERENCES milestones(id) ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_disbursements_opportunityId" ON disbursements ("opportunityId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_disbursements_milestoneId" ON disbursements ("milestoneId")
    `);

    // donations.disbursementId FK
    await queryRunner.query(`
      ALTER TABLE donations
        ADD COLUMN IF NOT EXISTS "disbursementId" INTEGER
          REFERENCES disbursements(id) ON DELETE SET NULL
    `);

    // Remove obsolete donations columns
    await queryRunner.query(`
      ALTER TABLE donations
        DROP COLUMN IF EXISTS "escrowTransactionId",
        DROP COLUMN IF EXISTS "disbursementTransactionId",
        DROP COLUMN IF EXISTS "granteeWalletId",
        DROP COLUMN IF EXISTS "adminApprovedBy",
        DROP COLUMN IF EXISTS "adminActionAt"
    `);

    // milestones FK to disbursements
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_milestones_disbursementId'
        ) THEN
          ALTER TABLE milestones
            ADD CONSTRAINT "FK_milestones_disbursementId"
            FOREIGN KEY ("disbursementId") REFERENCES disbursements(id)
            ON DELETE SET NULL
            NOT VALID;
        END IF;
      END $$;
    `);

    // Index on donationStep
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_donations_donationStep" ON donations ("donationStep")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE milestones DROP CONSTRAINT IF EXISTS "FK_milestones_disbursementId"`,
    );
    await queryRunner.query(
      `ALTER TABLE donations DROP CONSTRAINT IF EXISTS "donations_disbursementId_fkey"`,
    );

    await queryRunner.query(`
      ALTER TABLE donations
        ADD COLUMN IF NOT EXISTS "escrowTransactionId"       VARCHAR,
        ADD COLUMN IF NOT EXISTS "disbursementTransactionId" VARCHAR,
        ADD COLUMN IF NOT EXISTS "granteeWalletId"           VARCHAR,
        ADD COLUMN IF NOT EXISTS "adminApprovedBy"           INTEGER,
        ADD COLUMN IF NOT EXISTS "adminActionAt"             TIMESTAMPTZ
    `);

    await queryRunner.query(
      `ALTER TABLE donations DROP COLUMN IF EXISTS "disbursementId"`,
    );
    await queryRunner.query(
      `ALTER TABLE donations DROP COLUMN IF EXISTS "donationStep"`,
    );
    await queryRunner.query(
      `ALTER TABLE donations DROP COLUMN IF EXISTS "paymentSource"`,
    );
    await queryRunner.query(
      `ALTER TABLE donations DROP COLUMN IF EXISTS "stepHistory"`,
    );
    await queryRunner.query(
      `ALTER TABLE donations DROP COLUMN IF EXISTS "failureReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE donations DROP COLUMN IF EXISTS "metadata"`,
    );

    await queryRunner.query(`
      ALTER TABLE milestones
        DROP COLUMN IF EXISTS "proofDocuments",
        DROP COLUMN IF EXISTS "proofSubmittedAt",
        DROP COLUMN IF EXISTS "proofSubmittedBy",
        DROP COLUMN IF EXISTS "proofRejectionReason",
        DROP COLUMN IF EXISTS "disbursementId",
        DROP COLUMN IF EXISTS "disbursedAt",
        DROP COLUMN IF EXISTS "disbursedBy"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS disbursements`);
    await queryRunner.query(`DROP TYPE IF EXISTS "disbursement_status_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "donations_paymentsource_enum"`,
    );
  }
}
