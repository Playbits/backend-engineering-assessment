import {
  Inject,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CandidateDocument } from "../entities/candidate-document.entity";
import {
  CandidateSummary,
  SummaryStatus,
} from "../entities/candidate-summary.entity";
import {
  SUMMARIZATION_PROVIDER,
  SummarizationProvider,
} from "../llm/summarization-provider.interface";
import { QueueService } from "../queue/queue.service";

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
    this.logger.log(
      "Summarization worker initialized. Starting job Polling...",
    );
    this.pollJobs();
  }

  onModuleDestroy() {
    if (this.pollingInterval) {
      this.logger.log("Stopping summarization worker polling...");
      clearTimeout(this.pollingInterval);
    }
  }

  private async pollJobs() {
    // Basic polling loop for the fake queue
    // In a real app we'd use BullMQ or similar
    const poll = async () => {
      try {
        const jobs = this.queueService.getQueuedJobs();
        const summarizeJobs = jobs.filter(
          (j) => j.name === "summarize-candidate",
        );

        for (const job of summarizeJobs) {
          const { summaryId, candidateId, workspaceId } = job.payload as {
            summaryId: string;
            candidateId: string;
            workspaceId: string;
          };

          // Attempt to mark as IN_PROGRESS to avoid double processing
          const updateResult = await this.summaryRepo.update(
            { id: summaryId, status: SummaryStatus.PENDING },
            { status: SummaryStatus.IN_PROGRESS },
          );

          if (updateResult.affected && updateResult.affected > 0) {
            await this.processJob(summaryId, candidateId, workspaceId);
          }
        }
      } catch (error: any) {
        this.logger.error(`Error in polling loop: ${error.message}`);
      } finally {
        this.pollingInterval = setTimeout(poll, 2000);
      }
    };

    poll();
  }

  private async processJob(
    summaryId: string,
    candidateId: string,
    workspaceId: string,
  ) {
    this.logger.log(
      `Processing summary ${summaryId} for candidate ${candidateId} in workspace ${workspaceId}`,
    );

    try {
      // 1. Fetch candidate documents
      const documents = await this.documentRepo.findBy({
        candidateId,
        workspaceId,
      });
      const texts = documents.map((doc) => doc.rawText);

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
        provider: "GeminiSummarizationProvider",
        promptVersion: "2.0-flash",
      });

      this.logger.log(`Summary ${summaryId} completed successfully.`);
    } catch (error: any) {
      this.logger.error(
        `Error processing summary ${summaryId}: ${error.message}`,
      );
      await this.summaryRepo.update(summaryId, {
        status: SummaryStatus.FAILED,
        errorMessage: error.message,
      });
    }
  }
}
