import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeDonationsOptional1777558000000 implements MigrationInterface {
  name = 'MakeDonationsOptional1777558000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "campaignId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "beneficiaryId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "milestoneId" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "milestoneId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "beneficiaryId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "campaignId" SET NOT NULL`,
    );
  }
}
