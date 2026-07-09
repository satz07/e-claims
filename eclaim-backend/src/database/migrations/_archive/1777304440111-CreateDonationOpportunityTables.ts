import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDonationOpportunityTables1777304440111
  implements MigrationInterface
{
  name = 'CreateDonationOpportunityTables1777304440111';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."attachments_ownertype_enum" AS ENUM('opportunity', 'project_plan', 'milestone')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."attachments_type_enum" AS ENUM('document', 'proof', 'spending', 'report')`,
    );
    await queryRunner.query(
      `CREATE TABLE "attachments" ("id" SERIAL NOT NULL, "ownerId" integer NOT NULL, "ownerType" "public"."attachments_ownertype_enum" NOT NULL, "type" "public"."attachments_type_enum" NOT NULL, "fileUrl" text NOT NULL, "fileName" character varying, "uploadedBy" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5e1f050bcff31e3084a1d662412" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9e0bcd4634197349da741a723f" ON "attachments" ("ownerId", "ownerType") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donation_opportunities_sector_enum" AS ENUM('Education', 'Health', 'Environment', 'Social')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donation_opportunities_prioritylevel_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH')`,
    );
    await queryRunner.query(
      `CREATE TABLE "donation_opportunities" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "description" text NOT NULL, "targetAmount" numeric(18,2) NOT NULL, "sector" "public"."donation_opportunities_sector_enum" NOT NULL, "priorityLevel" "public"."donation_opportunities_prioritylevel_enum" NOT NULL DEFAULT 'MEDIUM', "startDate" date NOT NULL, "endDate" date NOT NULL, "targetOutcome" text NOT NULL, "expectedBeneficiaries" text, "implementationPartnerId" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_71ac93acf89440f97d71a7fe22c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_910d493091d77a72815e9bbac4" ON "donation_opportunities" ("implementationPartnerId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "project_plans" ("id" SERIAL NOT NULL, "opportunityId" integer NOT NULL, "startDate" date NOT NULL, "endDate" date NOT NULL, "targetOutcome" text NOT NULL, "expectedBeneficiaries" text, "brief" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_a06af7d6fdd91a07093c27fb379" UNIQUE ("opportunityId"), CONSTRAINT "REL_a06af7d6fdd91a07093c27fb37" UNIQUE ("opportunityId"), CONSTRAINT "PK_f095cc08244c610430243d8bd8c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "beneficiaries" ("id" SERIAL NOT NULL, "projectPlanId" integer NOT NULL, "name" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c9356d282dec80f7f12a9eef10a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9c4feab783ed57f0ca3335dc26" ON "beneficiaries" ("projectPlanId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."milestones_status_enum" AS ENUM('pending', 'in_progress', 'completed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "milestones" ("id" SERIAL NOT NULL, "beneficiaryId" integer NOT NULL, "title" character varying NOT NULL, "startDate" date NOT NULL, "endDate" date NOT NULL, "amount" numeric(18,2) NOT NULL, "description" text, "progress" smallint NOT NULL DEFAULT '0', "status" "public"."milestones_status_enum" NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_4e826d1a5a1bb3eaa1c0da1aa2" CHECK ("progress" >= 0 AND "progress" <= 100), CONSTRAINT "PK_0bdbfe399c777a6a8520ff902d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e713f3fd2556b70d94ff6e92f9" ON "milestones" ("beneficiaryId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "project_plans" ADD CONSTRAINT "FK_a06af7d6fdd91a07093c27fb379" FOREIGN KEY ("opportunityId") REFERENCES "donation_opportunities"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "beneficiaries" ADD CONSTRAINT "FK_9c4feab783ed57f0ca3335dc26a" FOREIGN KEY ("projectPlanId") REFERENCES "project_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ADD CONSTRAINT "FK_e713f3fd2556b70d94ff6e92f93" FOREIGN KEY ("beneficiaryId") REFERENCES "beneficiaries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "milestones" DROP CONSTRAINT "FK_e713f3fd2556b70d94ff6e92f93"`,
    );
    await queryRunner.query(
      `ALTER TABLE "beneficiaries" DROP CONSTRAINT "FK_9c4feab783ed57f0ca3335dc26a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_plans" DROP CONSTRAINT "FK_a06af7d6fdd91a07093c27fb379"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e713f3fd2556b70d94ff6e92f9"`,
    );
    await queryRunner.query(`DROP TABLE "milestones"`);
    await queryRunner.query(`DROP TYPE "public"."milestones_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9c4feab783ed57f0ca3335dc26"`,
    );
    await queryRunner.query(`DROP TABLE "beneficiaries"`);
    await queryRunner.query(`DROP TABLE "project_plans"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_910d493091d77a72815e9bbac4"`,
    );
    await queryRunner.query(`DROP TABLE "donation_opportunities"`);
    await queryRunner.query(
      `DROP TYPE "public"."donation_opportunities_prioritylevel_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."donation_opportunities_sector_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9e0bcd4634197349da741a723f"`,
    );
    await queryRunner.query(`DROP TABLE "attachments"`);
    await queryRunner.query(`DROP TYPE "public"."attachments_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."attachments_ownertype_enum"`);
  }
}
