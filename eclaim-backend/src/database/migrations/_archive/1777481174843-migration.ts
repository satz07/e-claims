import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1777481174843 implements MigrationInterface {
  name = 'Migration1777481174843';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
      `CREATE TYPE "public"."transfer_history_paymentmethod_enum" AS ENUM('LEAN_OPEN_BANKING', 'LEAN_BANK_TRANSFER', 'LEAN_CARD', 'FAB_LOCAL_TRANSFER', 'FAB_INTERNAL_TRANSFER', 'FAB_SWIFT', 'MANUAL_ADJUSTMENT', 'SYSTEM_WALLET')`,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
  }
}
