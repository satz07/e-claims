import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateOpportunityWithCampaign1777396272240
  implements MigrationInterface
{
  name = 'UpdateOpportunityWithCampaign1777396272240';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" ADD "campaignId" integer`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donation_opportunities_campaignrequeststatus_enum" AS ENUM('NONE', 'PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" ADD "campaignRequestStatus" "public"."donation_opportunities_campaignrequeststatus_enum" NOT NULL DEFAULT 'NONE'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7fa1f236834d92e31e4d9c680e" ON "donation_opportunities" ("campaignId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" ADD CONSTRAINT "FK_7fa1f236834d92e31e4d9c680e9" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" DROP CONSTRAINT "FK_7fa1f236834d92e31e4d9c680e9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7fa1f236834d92e31e4d9c680e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" DROP COLUMN "campaignRequestStatus"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."donation_opportunities_campaignrequeststatus_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" DROP COLUMN "campaignId"`,
    );
  }
}
