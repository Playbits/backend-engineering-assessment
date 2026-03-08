import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCandidateTables1772957733073 implements MigrationInterface {
    name = 'CreateCandidateTables1772957733073'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "candidate_summaries_status_enum" AS ENUM('pending', 'completed', 'failed');
        `);
        await queryRunner.query(`
            CREATE TABLE "candidate_documents" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "candidate_id" character varying(64) NOT NULL,
                "document_type" character varying(50) NOT NULL,
                "file_name" character varying(255) NOT NULL,
                "storage_key" character varying(512) NOT NULL,
                "raw_text" text NOT NULL,
                "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_candidate_documents" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "candidate_summaries" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "candidate_id" character varying(64) NOT NULL,
                "status" "candidate_summaries_status_enum" NOT NULL DEFAULT 'pending',
                "score" double precision,
                "strengths" jsonb,
                "concerns" jsonb,
                "summary" text,
                "recommended_decision" character varying(50),
                "provider" character varying(100),
                "prompt_version" character varying(20),
                "error_message" text,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_candidate_summaries" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "candidate_summaries"`);
        await queryRunner.query(`DROP TABLE "candidate_documents"`);
        await queryRunner.query(`DROP TYPE "candidate_summaries_status_enum"`);
    }
}
