import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";

import { AuthModule } from "./auth/auth.module";
import {
  defaultDatabaseUrl,
  getTypeOrmOptions,
} from "./config/typeorm.options";
import { HealthModule } from "./health/health.module";
import { LlmModule } from "./llm/llm.module";
import { QueueModule } from "./queue/queue.module";
import { CandidatesModule } from "./candidates/candidates.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        getTypeOrmOptions(
          configService.get<string>("DATABASE_URL") ?? defaultDatabaseUrl,
        ),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isTest = configService.get<string>("NODE_ENV") === "test";
        if (isTest) {
          return {
            connection: {
              host: "localhost",
              port: 6379,
              offlineQueue: false,
              lazyConnect: true,
            },
          };
        }
        return {
          connection: {
            host: configService.get<string>("REDIS_HOST") ?? "localhost",
            port: configService.get<number>("REDIS_PORT") ?? 6379,
          },
        };
      },
    }),
    AuthModule,
    HealthModule,
    QueueModule,
    LlmModule,
    CandidatesModule,
  ],
})
export class AppModule {}
