import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1777469833090 implements MigrationInterface {
  name = 'Migration1777469833090';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."donations_status_enum" AS ENUM('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'REVERSED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "donations" ("id" SERIAL NOT NULL, "donorId" integer NOT NULL, "walletId" character varying NOT NULL, "transactionId" character varying, "campaignId" integer NOT NULL, "opportunityId" integer NOT NULL, "beneficiaryId" integer, "milestoneId" integer, "amountMinor" bigint NOT NULL, "currency" character varying(8) NOT NULL, "status" "public"."donations_status_enum" NOT NULL DEFAULT 'PENDING', "donatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c01355d6f6f50fc6d1b4a946abf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e3eebd26ba5ec476feb06c93ce" ON "donations" ("donorId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dce45a84508ba5fd75e35d6f2a" ON "donations" ("campaignId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5b1044b0d6664a06b419509b10" ON "donations" ("opportunityId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2eef9019bcbee68df010483c68" ON "donations" ("beneficiaryId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_80328ef8cdcdfbf2588f145f2e" ON "donations" ("milestoneId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD CONSTRAINT "FK_e3eebd26ba5ec476feb06c93cea" FOREIGN KEY ("donorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD CONSTRAINT "FK_dce45a84508ba5fd75e35d6f2a4" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD CONSTRAINT "FK_5b1044b0d6664a06b419509b10b" FOREIGN KEY ("opportunityId") REFERENCES "donation_opportunities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD CONSTRAINT "FK_2eef9019bcbee68df010483c682" FOREIGN KEY ("beneficiaryId") REFERENCES "beneficiaries"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD CONSTRAINT "FK_80328ef8cdcdfbf2588f145f2e2" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
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
      `ALTER TABLE "donations" DROP CONSTRAINT "FK_5b1044b0d6664a06b419509b10b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP CONSTRAINT "FK_dce45a84508ba5fd75e35d6f2a4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP CONSTRAINT "FK_e3eebd26ba5ec476feb06c93cea"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_80328ef8cdcdfbf2588f145f2e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2eef9019bcbee68df010483c68"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5b1044b0d6664a06b419509b10"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dce45a84508ba5fd75e35d6f2a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e3eebd26ba5ec476feb06c93ce"`,
    );
    await queryRunner.query(`DROP TABLE "donations"`);
    await queryRunner.query(`DROP TYPE "public"."donations_status_enum"`);
  }
}
