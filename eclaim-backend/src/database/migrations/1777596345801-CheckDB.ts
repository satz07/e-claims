import { MigrationInterface, QueryRunner } from 'typeorm';

export class CheckDB1777596345801 implements MigrationInterface {
  name = 'CheckDB1777596345801';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."disbursements_status_enum" AS ENUM('PENDING', 'SUCCESS', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "disbursements" ("id" SERIAL NOT NULL, "opportunityId" integer NOT NULL, "milestoneId" integer NOT NULL, "disbursedBy" integer NOT NULL, "totalAmountMinor" bigint NOT NULL, "currency" character varying(8) NOT NULL, "currencyDecimals" integer NOT NULL DEFAULT '18', "dfnsTransactionId" character varying, "recipientWalletId" character varying, "recipientWalletAddress" character varying, "status" "public"."disbursements_status_enum" NOT NULL DEFAULT 'PENDING', "failureReason" text, "dfnsPayload" jsonb, "donationCount" integer NOT NULL DEFAULT '0', "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2f9ea0e5b8382113aaa3e51cdfa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3a5078bb2ae5956dbfee12bdd1" ON "disbursements" ("opportunityId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9e4615aec98c5a572a2235a0de" ON "disbursements" ("milestoneId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_430795ea92d9d411150694506d" ON "disbursements" ("opportunityId", "milestoneId") `,
    );
    await queryRunner.query(`ALTER TABLE "donations" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."donations_status_enum"`);
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "adminApprovedBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "adminActionAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "disbursementTransactionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "granteeWalletId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "escrowTransactionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ADD "proofDocuments" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ADD "proofSubmittedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ADD "proofSubmittedBy" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ADD "proofRejectionReason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ADD "disbursementId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ADD "disbursedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ADD "disbursedBy" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "disbursementId" integer`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."campaigns_status_enum" RENAME TO "campaigns_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."campaigns_status_enum" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'REJECTED', 'ON_HOLD', 'RETURNED', 'COMPLETED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" ALTER COLUMN "status" TYPE "public"."campaigns_status_enum" USING "status"::"text"::"public"."campaigns_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(`DROP TYPE "public"."campaigns_status_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."donation_opportunities_status_enum" RENAME TO "donation_opportunities_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donation_opportunities_status_enum" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'REJECTED', 'ON_HOLD', 'RETURNED', 'COMPLETED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" ALTER COLUMN "status" TYPE "public"."donation_opportunities_status_enum" USING "status"::"text"::"public"."donation_opportunities_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."donation_opportunities_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."milestones_status_enum" RENAME TO "milestones_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."milestones_status_enum" AS ENUM('pending', 'in_progress', 'proof_submitted', 'proof_rejected', 'completed', 'disbursed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ALTER COLUMN "status" TYPE "public"."milestones_status_enum" USING "status"::"text"::"public"."milestones_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "public"."milestones_status_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."donations_donationstep_enum" RENAME TO "donations_donationstep_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donations_donationstep_enum" AS ENUM('INITIATED', 'TRANSFERRED', 'DISBURSED', 'FAILED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "donationStep" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "donationStep" TYPE "public"."donations_donationstep_enum" USING "donationStep"::"text"::"public"."donations_donationstep_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "donationStep" SET DEFAULT 'INITIATED'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."donations_donationstep_enum_old"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a0fb1849e7a0797fe93acbc921"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transfer_history_provider_enum" RENAME TO "transfer_history_provider_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_history_provider_enum" AS ENUM('LEAN', 'FAB', 'MANUAL', 'DFNS')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ALTER COLUMN "provider" TYPE "public"."transfer_history_provider_enum" USING "provider"::"text"::"public"."transfer_history_provider_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transfer_history_provider_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transfer_history_paymentmethod_enum" RENAME TO "transfer_history_paymentmethod_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_history_paymentmethod_enum" AS ENUM('LEAN_OPEN_BANKING', 'LEAN_BANK_TRANSFER', 'LEAN_CARD', 'FAB_LOCAL_TRANSFER', 'FAB_INTERNAL_TRANSFER', 'FAB_SWIFT', 'MANUAL_ADJUSTMENT', 'DFNS_CRYPTO_TRANSFER')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ALTER COLUMN "paymentMethod" TYPE "public"."transfer_history_paymentmethod_enum" USING "paymentMethod"::"text"::"public"."transfer_history_paymentmethod_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transfer_history_paymentmethod_enum_old"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a0fb1849e7a0797fe93acbc921" ON "transfer_history" ("provider", "providerReference") `,
    );
    await queryRunner.query(
      `ALTER TABLE "disbursements" ADD CONSTRAINT "FK_3a5078bb2ae5956dbfee12bdd17" FOREIGN KEY ("opportunityId") REFERENCES "donation_opportunities"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "disbursements" ADD CONSTRAINT "FK_9e4615aec98c5a572a2235a0de5" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "disbursements" DROP CONSTRAINT "FK_9e4615aec98c5a572a2235a0de5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disbursements" DROP CONSTRAINT "FK_3a5078bb2ae5956dbfee12bdd17"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a0fb1849e7a0797fe93acbc921"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_history_paymentmethod_enum_old" AS ENUM('LEAN_OPEN_BANKING', 'LEAN_BANK_TRANSFER', 'LEAN_CARD', 'FAB_LOCAL_TRANSFER', 'FAB_INTERNAL_TRANSFER', 'FAB_SWIFT', 'MANUAL_ADJUSTMENT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ALTER COLUMN "paymentMethod" TYPE "public"."transfer_history_paymentmethod_enum_old" USING "paymentMethod"::"text"::"public"."transfer_history_paymentmethod_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transfer_history_paymentmethod_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transfer_history_paymentmethod_enum_old" RENAME TO "transfer_history_paymentmethod_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_history_provider_enum_old" AS ENUM('LEAN', 'FAB', 'MANUAL')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ALTER COLUMN "provider" TYPE "public"."transfer_history_provider_enum_old" USING "provider"::"text"::"public"."transfer_history_provider_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transfer_history_provider_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transfer_history_provider_enum_old" RENAME TO "transfer_history_provider_enum"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a0fb1849e7a0797fe93acbc921" ON "transfer_history" ("provider", "providerReference") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donations_donationstep_enum_old" AS ENUM('INITIATED', 'ESCROW_PENDING', 'ESCROWED', 'BANK_RECEIVED', 'MILESTONE_COMPLETE', 'ADMIN_REVIEW', 'ADMIN_APPROVED', 'ADMIN_REJECTED', 'DISBURSING', 'DISBURSED', 'FAILED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "donationStep" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "donationStep" TYPE "public"."donations_donationstep_enum_old" USING "donationStep"::"text"::"public"."donations_donationstep_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "donationStep" SET DEFAULT 'INITIATED'`,
    );
    await queryRunner.query(`DROP TYPE "public"."donations_donationstep_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."donations_donationstep_enum_old" RENAME TO "donations_donationstep_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."milestones_status_enum_old" AS ENUM('pending', 'in_progress', 'completed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ALTER COLUMN "status" TYPE "public"."milestones_status_enum_old" USING "status"::"text"::"public"."milestones_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "public"."milestones_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."milestones_status_enum_old" RENAME TO "milestones_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donation_opportunities_status_enum_old" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ON_HOLD', 'RETURNED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" ALTER COLUMN "status" TYPE "public"."donation_opportunities_status_enum_old" USING "status"::"text"::"public"."donation_opportunities_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."donation_opportunities_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."donation_opportunities_status_enum_old" RENAME TO "donation_opportunities_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."campaigns_status_enum_old" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ON_HOLD', 'RETURNED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" ALTER COLUMN "status" TYPE "public"."campaigns_status_enum_old" USING "status"::"text"::"public"."campaigns_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(`DROP TYPE "public"."campaigns_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."campaigns_status_enum_old" RENAME TO "campaigns_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "disbursementId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" DROP COLUMN "disbursedBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" DROP COLUMN "disbursedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" DROP COLUMN "disbursementId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" DROP COLUMN "proofRejectionReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" DROP COLUMN "proofSubmittedBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" DROP COLUMN "proofSubmittedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" DROP COLUMN "proofDocuments"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "escrowTransactionId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "granteeWalletId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "disbursementTransactionId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "adminActionAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "adminApprovedBy" integer`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donations_status_enum" AS ENUM('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'REVERSED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "status" "public"."donations_status_enum" NOT NULL DEFAULT 'PENDING'`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_430795ea92d9d411150694506d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9e4615aec98c5a572a2235a0de"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3a5078bb2ae5956dbfee12bdd1"`,
    );
    await queryRunner.query(`DROP TABLE "disbursements"`);
    await queryRunner.query(`DROP TYPE "public"."disbursements_status_enum"`);
  }
}
