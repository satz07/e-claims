import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDonationToTransferHistory1777320145542
  implements MigrationInterface
{
  name = 'AddDonationToTransferHistory1777320145542';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ADD "opportunityId" integer`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transfer_history_type_enum" RENAME TO "transfer_history_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_history_type_enum" AS ENUM('BANK_TOPUP', 'BANK_TRANSFER', 'WITHDRAWAL', 'REFUND', 'ADJUSTMENT', 'DONATION')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ALTER COLUMN "type" TYPE "public"."transfer_history_type_enum" USING "type"::"text"::"public"."transfer_history_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transfer_history_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_85a95f6173c10f1ab1e889fa68" ON "transfer_history" ("opportunityId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ADD CONSTRAINT "FK_85a95f6173c10f1ab1e889fa682" FOREIGN KEY ("opportunityId") REFERENCES "donation_opportunities"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transfer_history" DROP CONSTRAINT "FK_85a95f6173c10f1ab1e889fa682"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_85a95f6173c10f1ab1e889fa68"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_history_type_enum_old" AS ENUM('BANK_TOPUP', 'BANK_TRANSFER', 'WITHDRAWAL', 'REFUND', 'ADJUSTMENT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ALTER COLUMN "type" TYPE "public"."transfer_history_type_enum_old" USING "type"::"text"::"public"."transfer_history_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."transfer_history_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."transfer_history_type_enum_old" RENAME TO "transfer_history_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" DROP COLUMN "opportunityId"`,
    );
  }
}
