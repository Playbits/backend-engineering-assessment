import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Index,
} from "typeorm";

@Entity({ name: "candidate_documents" })
@Index(["candidateId", "workspaceId"])
export class CandidateDocument {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "candidate_id", type: "varchar", length: 64 })
  candidateId!: string;

  @Column({ name: "workspace_id", type: "varchar", length: 64 })
  workspaceId!: string;

  @Column({ name: "document_type", type: "varchar", length: 50 })
  documentType!: string;

  @Column({ name: "file_name", type: "varchar", length: 255 })
  fileName!: string;

  @Column({ name: "storage_key", type: "varchar", length: 512 })
  storageKey!: string;

  @Column({ name: "raw_text", type: "text" })
  rawText!: string;

  @CreateDateColumn({ name: "uploaded_at", type: "timestamptz" })
  uploadedAt!: Date;
}
