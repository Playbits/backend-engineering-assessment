import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexesToCandidateTables1772959100000 implements MigrationInterface {
  name = "AddIndexesToCandidateTables1772959100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_candidate_documents_candidate_workspace" ON "candidate_documents" ("candidate_id", "workspace_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_candidate_summaries_candidate_workspace" ON "candidate_summaries" ("candidate_id", "workspace_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_candidate_summaries_candidate_workspace"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_candidate_documents_candidate_workspace"`,
    );
  }
}
