import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum SummaryStatus {
  PENDING = "pending",
  IN_PROGRESS = "in-progress",
  COMPLETED = "completed",
  FAILED = "failed",
}

@Entity({ name: "candidate_summaries" })
export class CandidateSummary {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "candidate_id", type: "varchar", length: 64 })
  candidateId!: string;

  @Column({ name: "workspace_id", type: "varchar", length: 64 })
  workspaceId!: string;

  @Column({
    type: "enum",
    enum: SummaryStatus,
    default: SummaryStatus.PENDING,
  })
  status!: SummaryStatus;

  @Column({ type: "float", nullable: true })
  score!: number | null;

  @Column({ type: "jsonb", nullable: true })
  strengths!: string[] | null;

  @Column({ type: "jsonb", nullable: true })
  concerns!: string[] | null;

  @Column({ type: "text", nullable: true })
  summary!: string | null;

  @Column({
    name: "recommended_decision",
    type: "varchar",
    length: 50,
    nullable: true,
  })
  recommendedDecision!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  provider!: string | null;

  @Column({
    name: "prompt_version",
    type: "varchar",
    length: 20,
    nullable: true,
  })
  promptVersion!: string | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
