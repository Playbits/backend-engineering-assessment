import { Inject, Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary, SummaryStatus } from '../entities/candidate-summary.entity';
import {
  SUMMARIZATION_PROVIDER,
  SummarizationProvider,
} from '../llm/summarization-provider.interface';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class SummarizationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SummarizationWorker.name);
  private pollingInterval?: NodeJS.Timeout;

  constructor(
    private readonly queueService: QueueService,
    @InjectRepository(CandidateDocument)
    private readonly documentRepo: Repository<CandidateDocument>,
    @InjectRepository(CandidateSummary)
    private readonly summaryRepo: Repository<CandidateSummary>,
    @Inject(SUMMARIZATION_PROVIDER)
    private readonly summarizationProvider: SummarizationProvider,
  ) {}

  onModuleInit() {
    this.logger.log('Summarization worker initialized. Starting job Polling...');
    this.pollJobs();
  }

  onModuleDestroy() {
    if (this.pollingInterval) {
      this.logger.log('Stopping summarization worker polling...');
      clearInterval(this.pollingInterval);
    }
  }

  private async pollJobs() {
    // Basic polling loop for the fake queue
    // In a real app we'd use BullMQ or similar
    this.pollingInterval = setInterval(async () => {
      const jobs = this.queueService.getQueuedJobs();
      const summarizeJobs = jobs.filter(j => j.name === 'summarize-candidate');
      
      // For this assessment, we'll just process any new jobs we find
      // Actually, since getQueuedJobs returns the whole list, 
      // we need a way to mark them as 'in-progress' or just handle one-by-one.
      // Given the simple QueueService, I'll simulate processing by checking status.
      
      for (const job of summarizeJobs) {
        const { summaryId, candidateId, workspaceId } = job.payload as {
          summaryId: string;
          candidateId: string;
          workspaceId: string;
        };

        const summary = await this.summaryRepo.findOneBy({ id: summaryId });
        if (summary && summary.status === SummaryStatus.PENDING) {
          await this.processJob(summaryId, candidateId, workspaceId);
        }
      }
    }, 2000);
  }

  private async processJob(summaryId: string, candidateId: string, workspaceId: string) {
    this.logger.log(`Processing summary ${summaryId} for candidate ${candidateId} in workspace ${workspaceId}`);

    try {
      // 1. Fetch candidate documents
      const documents = await this.documentRepo.findBy({ candidateId, workspaceId });
      const texts = documents.map(doc => doc.rawText);

      // 2. Call Summarization Provider
      const result = await this.summarizationProvider.generateCandidateSummary({
        candidateId,
        documents: texts,
      });

      // 3. Update Summary record
      await this.summaryRepo.update(summaryId, {
        status: SummaryStatus.COMPLETED,
        score: result.score,
        strengths: result.strengths,
        concerns: result.concerns,
        summary: result.summary,
        recommendedDecision: result.recommendedDecision,
        provider: 'GeminiSummarizationProvider',
        promptVersion: '2.0-flash',
      });

      this.logger.log(`Summary ${summaryId} completed successfully.`);
    } catch (error: any) {
      this.logger.error(`Error processing summary ${summaryId}: ${error.message}`);
      await this.summaryRepo.update(summaryId, {
        status: SummaryStatus.FAILED,
        errorMessage: error.message,
      });
    }
  }
}
