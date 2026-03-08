import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceIdToPartB1772958985382 implements MigrationInterface {
    name = 'AddWorkspaceIdToPartB1772958985382'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidate_documents" ADD "workspace_id" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "candidate_summaries" ADD "workspace_id" character varying(64)`);
        
        // Update existing records with a default workspace if necessary, but here we assume it's fresh enough.
        // If there were records, we'd need a default value or to allow null.
        // For the assessment, we'll make them NOT NULL after deployment if required, or just keep them nullable for now.
        // Actually, requirement says "belong to a workspace", so let's make them NOT NULL eventually.
        // But for migration safety, we add then update then alter.
        
        // Since it's a new requirement, we'll just allow NULL for now or set a default.
        // I'll set them as NOT NULL with a default for existing ones if any.
        await queryRunner.query(`UPDATE "candidate_documents" SET "workspace_id" = 'default-workspace' WHERE "workspace_id" IS NULL`);
        await queryRunner.query(`UPDATE "candidate_summaries" SET "workspace_id" = 'default-workspace' WHERE "workspace_id" IS NULL`);
        
        await queryRunner.query(`ALTER TABLE "candidate_documents" ALTER COLUMN "workspace_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "candidate_summaries" ALTER COLUMN "workspace_id" SET NOT NULL`);

        await queryRunner.query(`CREATE INDEX "idx_candidate_documents_workspace_candidate" ON "candidate_documents" ("workspace_id", "candidate_id")`);
        await queryRunner.query(`CREATE INDEX "idx_candidate_summaries_workspace_candidate" ON "candidate_summaries" ("workspace_id", "candidate_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "idx_candidate_summaries_workspace_candidate"`);
        await queryRunner.query(`DROP INDEX "idx_candidate_documents_workspace_candidate"`);
        await queryRunner.query(`ALTER TABLE "candidate_summaries" DROP COLUMN "workspace_id"`);
        await queryRunner.query(`ALTER TABLE "candidate_documents" DROP COLUMN "workspace_id"`);
    }
}
