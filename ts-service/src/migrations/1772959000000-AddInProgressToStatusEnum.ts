import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInProgressToStatusEnum1772959000000 implements MigrationInterface {
  name = "AddInProgressToStatusEnum1772959000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "candidate_summaries_status_enum" ADD VALUE 'in-progress'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL doesn't support removing a value from an enum easily.
    // For development/assessment purposes, we'll leave it as is or drop/recreate if necessary.
    // But usually we don't remove enum values in a simple migration.
  }
}
