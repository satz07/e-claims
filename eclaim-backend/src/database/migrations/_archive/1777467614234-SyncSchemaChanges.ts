import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncSchemaChanges1777467614234 implements MigrationInterface {
  name = 'SyncSchemaChanges1777467614234';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" DROP CONSTRAINT "FK_7fa1f236834d92e31e4d9c680e9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" ALTER COLUMN "campaignId" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9e0bcd4634197349da741a723f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ALTER COLUMN "ownerId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."attachments_type_enum" RENAME TO "attachments_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."attachments_type_enum" AS ENUM('document', 'proof', 'spending', 'report', 'banner')`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ALTER COLUMN "type" TYPE "public"."attachments_type_enum" USING "type"::"text"::"public"."attachments_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."attachments_type_enum_old"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_9e0bcd4634197349da741a723f" ON "attachments" ("ownerId", "ownerType") `,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" ADD CONSTRAINT "FK_7fa1f236834d92e31e4d9c680e9" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" DROP CONSTRAINT "FK_7fa1f236834d92e31e4d9c680e9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9e0bcd4634197349da741a723f"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."attachments_type_enum_old" AS ENUM('document', 'proof', 'spending', 'report')`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ALTER COLUMN "type" TYPE "public"."attachments_type_enum_old" USING "type"::"text"::"public"."attachments_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."attachments_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."attachments_type_enum_old" RENAME TO "attachments_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ALTER COLUMN "ownerId" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9e0bcd4634197349da741a723f" ON "attachments" ("ownerId", "ownerType") `,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" ALTER COLUMN "campaignId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" ADD CONSTRAINT "FK_7fa1f236834d92e31e4d9c680e9" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
