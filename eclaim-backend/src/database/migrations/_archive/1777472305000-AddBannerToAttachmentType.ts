import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBannerToAttachmentType1777472305000
  implements MigrationInterface
{
  name = 'AddBannerToAttachmentType1777472305000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // We use a raw query because TypeORM doesn't always handle enum additions well in migrations
    // and this ensures the value is added correctly to the PostgreSQL type.
    await queryRunner.query(
      `ALTER TYPE "public"."attachments_type_enum" ADD VALUE 'banner'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Removing a value from an enum in PostgreSQL is not directly supported without
    // dropping and recreating the type, which is complex and data-destructive.
    // Given this is a small additive change, we leave down() empty or as a no-op.
  }
}
