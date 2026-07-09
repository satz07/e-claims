import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOpportunityApprovalStatus1777310983313
  implements MigrationInterface
{
  name = 'AddOpportunityApprovalStatus1777310983313';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."donation_opportunities_status_enum" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ON_HOLD', 'RETURNED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" ADD "status" "public"."donation_opportunities_status_enum" NOT NULL DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" ADD "statusReason" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" DROP COLUMN "statusReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donation_opportunities" DROP COLUMN "status"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."donation_opportunities_status_enum"`,
    );
  }
}
