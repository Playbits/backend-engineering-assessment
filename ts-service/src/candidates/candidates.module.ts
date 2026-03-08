import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { QueueModule } from '../queue/queue.module';
import { LlmModule } from '../llm/llm.module';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { SummarizationWorker } from './summarization.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([CandidateDocument, CandidateSummary]),
    QueueModule,
    LlmModule,
  ],
  controllers: [CandidatesController],
  providers: [CandidatesService, SummarizationWorker],
  exports: [CandidatesService],
})
export class CandidatesModule {}
