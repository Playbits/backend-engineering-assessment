import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { DataSourceOptions } from "typeorm";

import { CandidateDocument } from "../entities/candidate-document.entity";
import { CandidateSummary } from "../entities/candidate-summary.entity";
import { SampleCandidate } from "../entities/sample-candidate.entity";
import { SampleWorkspace } from "../entities/sample-workspace.entity";
import { InitialStarterEntities1710000000000 } from "../migrations/1710000000000-InitialStarterEntities";
import { CreateCandidateTables1772957733073 } from "../migrations/1772957733073-CreateCandidateTables";
import { AddWorkspaceIdToPartB1772958985382 } from "../migrations/1772958985382-AddWorkspaceIdToPartB";
import { AddInProgressToStatusEnum1772959000000 } from "../migrations/1772959000000-AddInProgressToStatusEnum";

export const defaultDatabaseUrl =
  "postgres://assessment_user:assessment_pass@localhost:5432/assessment_db";

export const getTypeOrmOptions = (
  databaseUrl: string,
): TypeOrmModuleOptions & DataSourceOptions => ({
  type: "postgres",
  url: databaseUrl,
  entities: [
    SampleWorkspace,
    SampleCandidate,
    CandidateDocument,
    CandidateSummary,
  ],
  migrations: [
    InitialStarterEntities1710000000000,
    CreateCandidateTables1772957733073,
    AddWorkspaceIdToPartB1772958985382,
    AddInProgressToStatusEnum1772959000000,
  ],
  migrationsTableName: "typeorm_migrations",
  synchronize: false,
  logging: false,
});
