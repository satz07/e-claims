import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1777489599350 implements MigrationInterface {
  name = 'Migration1777489599350';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "donations" DROP CONSTRAINT "FK_80328ef8cdcdfbf2588f145f2e2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP CONSTRAINT "FK_2eef9019bcbee68df010483c682"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_268e5e2963f890e942a3418b60"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" DROP COLUMN "linkedTransferId"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donations_paymentsource_enum" AS ENUM('WALLET', 'FIAT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "paymentSource" "public"."donations_paymentsource_enum" NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donations_donationstep_enum" AS ENUM('INITIATED', 'ESCROW_PENDING', 'ESCROWED', 'BANK_RECEIVED', 'MILESTONE_COMPLETE', 'ADMIN_REVIEW', 'ADMIN_APPROVED', 'ADMIN_REJECTED', 'DISBURSING', 'DISBURSED', 'FAILED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "donationStep" "public"."donations_donationstep_enum" NOT NULL DEFAULT 'INITIATED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "escrowTransactionId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "disbursementTransactionId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "granteeWalletId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "adminApprovedBy" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "adminActionAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`ALTER TABLE "donations" ADD "failureReason" text`);
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "stepHistory" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(`ALTER TABLE "donations" ADD "metadata" jsonb`);
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
      `CREATE TYPE "public"."transfer_history_paymentmethod_enum" AS ENUM('LEAN_OPEN_BANKING', 'LEAN_BANK_TRANSFER', 'LEAN_CARD', 'FAB_LOCAL_TRANSFER', 'FAB_INTERNAL_TRANSFER', 'FAB_SWIFT', 'MANUAL_ADJUSTMENT', 'SYSTEM_WALLET', 'DFNS_CRYPTO_TRANSFER')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ALTER COLUMN "paymentMethod" TYPE "public"."transfer_history_paymentmethod_enum" USING "paymentMethod"::"text"::"public"."transfer_history_paymentmethod_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transfer_history_paymentmethod_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transfer_history_type_enum" RENAME TO "transfer_history_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_history_type_enum" AS ENUM('BANK_TOPUP', 'BANK_TRANSFER', 'WITHDRAWAL', 'REFUND', 'ADJUSTMENT', 'DONATION', 'TOKEN_ISSUANCE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ALTER COLUMN "type" TYPE "public"."transfer_history_type_enum" USING "type"::"text"::"public"."transfer_history_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transfer_history_type_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transfer_history_status_enum" RENAME TO "transfer_history_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_history_status_enum" AS ENUM('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'REVERSED', 'CANCELLED', 'PENDING_APPROVAL')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ALTER COLUMN "status" TYPE "public"."transfer_history_status_enum" USING "status"::"text"::"public"."transfer_history_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ALTER COLUMN "status" SET DEFAULT 'INITIATED'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transfer_history_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "walletId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "beneficiaryId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "milestoneId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."donations_status_enum" RENAME TO "donations_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donations_status_enum" AS ENUM('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'REVERSED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "status" TYPE "public"."donations_status_enum" USING "status"::"text"::"public"."donations_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."donations_status_enum_old"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a0fb1849e7a0797fe93acbc921" ON "transfer_history" ("provider", "providerReference") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4b860fa1c211022a5c26bbcbc9" ON "donations" ("donationStep") `,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD CONSTRAINT "FK_2eef9019bcbee68df010483c682" FOREIGN KEY ("beneficiaryId") REFERENCES "beneficiaries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD CONSTRAINT "FK_80328ef8cdcdfbf2588f145f2e2" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "donations" DROP CONSTRAINT "FK_80328ef8cdcdfbf2588f145f2e2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP CONSTRAINT "FK_2eef9019bcbee68df010483c682"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4b860fa1c211022a5c26bbcbc9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a0fb1849e7a0797fe93acbc921"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donations_status_enum_old" AS ENUM('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'REVERSED', 'CANCELLED', 'PENDING_APPROVAL')`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "status" TYPE "public"."donations_status_enum_old" USING "status"::"text"::"public"."donations_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."donations_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."donations_status_enum_old" RENAME TO "donations_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "milestoneId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "beneficiaryId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "walletId" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_history_status_enum_old" AS ENUM('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'REVERSED', 'CANCELLED', 'PENDING_APPROVAL')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ALTER COLUMN "status" TYPE "public"."transfer_history_status_enum_old" USING "status"::"text"::"public"."transfer_history_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ALTER COLUMN "status" SET DEFAULT 'INITIATED'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transfer_history_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transfer_history_status_enum_old" RENAME TO "transfer_history_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_history_type_enum_old" AS ENUM('BANK_TOPUP', 'BANK_TRANSFER', 'WITHDRAWAL', 'REFUND', 'ADJUSTMENT', 'DONATION', 'TOKEN_ISSUANCE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ALTER COLUMN "type" TYPE "public"."transfer_history_type_enum_old" USING "type"::"text"::"public"."transfer_history_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."transfer_history_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."transfer_history_type_enum_old" RENAME TO "transfer_history_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_history_paymentmethod_enum_old" AS ENUM('LEAN_OPEN_BANKING', 'LEAN_BANK_TRANSFER', 'LEAN_CARD', 'FAB_LOCAL_TRANSFER', 'FAB_INTERNAL_TRANSFER', 'FAB_SWIFT', 'MANUAL_ADJUSTMENT', 'SYSTEM_WALLET')`,
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
      `CREATE TYPE "public"."transfer_history_provider_enum_old" AS ENUM('LEAN', 'FAB', 'MANUAL', 'DFNS')`,
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
    await queryRunner.query(`ALTER TABLE "donations" DROP COLUMN "metadata"`);
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "stepHistory"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "failureReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "adminActionAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "adminApprovedBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "granteeWalletId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "disbursementTransactionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "escrowTransactionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "donationStep"`,
    );
    await queryRunner.query(`DROP TYPE "public"."donations_donationstep_enum"`);
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "paymentSource"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."donations_paymentsource_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ADD "linkedTransferId" integer`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_268e5e2963f890e942a3418b60" ON "transfer_history" ("linkedTransferId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD CONSTRAINT "FK_2eef9019bcbee68df010483c682" FOREIGN KEY ("beneficiaryId") REFERENCES "beneficiaries"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD CONSTRAINT "FK_80328ef8cdcdfbf2588f145f2e2" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
