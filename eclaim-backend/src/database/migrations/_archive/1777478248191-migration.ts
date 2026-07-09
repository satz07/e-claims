import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1777478248191 implements MigrationInterface {
  name = 'Migration1777478248191';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ADD "linkedTransferId" integer`,
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
      `ALTER TYPE "public"."donations_status_enum" RENAME TO "donations_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donations_status_enum" AS ENUM('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'REVERSED', 'CANCELLED', 'PENDING_APPROVAL')`,
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
      `CREATE INDEX "IDX_268e5e2963f890e942a3418b60" ON "transfer_history" ("linkedTransferId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_268e5e2963f890e942a3418b60"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donations_status_enum_old" AS ENUM('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'REVERSED', 'CANCELLED')`,
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
      `CREATE TYPE "public"."transfer_history_status_enum_old" AS ENUM('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'REVERSED', 'CANCELLED')`,
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
      `CREATE TYPE "public"."transfer_history_type_enum_old" AS ENUM('BANK_TOPUP', 'BANK_TRANSFER', 'WITHDRAWAL', 'REFUND', 'ADJUSTMENT', 'DONATION')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ALTER COLUMN "type" TYPE "public"."transfer_history_type_enum_old" USING "type"::"text"::"public"."transfer_history_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."transfer_history_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."transfer_history_type_enum_old" RENAME TO "transfer_history_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" DROP COLUMN "linkedTransferId"`,
    );
  }
}
