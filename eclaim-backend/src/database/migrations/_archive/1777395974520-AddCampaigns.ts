import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampaigns1777395974520 implements MigrationInterface {
  name = 'AddCampaigns1777395974520';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."campaigns_status_enum" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ON_HOLD', 'RETURNED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."campaigns_priority_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."campaigns_sector_enum" AS ENUM('Education', 'Health', 'Environment', 'Social')`,
    );
    await queryRunner.query(
      `CREATE TABLE "campaigns" ("id" SERIAL NOT NULL, "refCode" character varying NOT NULL, "title" character varying NOT NULL, "logoUrl" character varying, "globalTotal" numeric(18,2) NOT NULL, "globalMin" numeric(18,2) NOT NULL, "globalMax" numeric(18,2) NOT NULL, "currency" character varying NOT NULL DEFAULT 'USD', "beneficiaries" numeric(18,2), "targetOutcome" text, "startDate" date, "endDate" date, "status" "public"."campaigns_status_enum" NOT NULL DEFAULT 'DRAFT', "priority" "public"."campaigns_priority_enum" NOT NULL DEFAULT 'MEDIUM', "sector" "public"."campaigns_sector_enum", "partner" character varying, "summary" text, "fullDescription" text, "grantOverview" jsonb, "evalCriteria" jsonb, "selCriteria" jsonb, "cycles" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_831e3fcd4fc45b4e4c3f57a9ee4" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "campaigns"`);
    await queryRunner.query(`DROP TYPE "public"."campaigns_sector_enum"`);
    await queryRunner.query(`DROP TYPE "public"."campaigns_priority_enum"`);
    await queryRunner.query(`DROP TYPE "public"."campaigns_status_enum"`);
  }
}
