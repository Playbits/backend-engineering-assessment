import { Inject, Injectable, Logger } from "@nestjs/common";
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
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";

@Processor("summarization")
@Injectable()
export class SummarizationWorker extends WorkerHost {
  private readonly logger = new Logger(SummarizationWorker.name);

  constructor(
    @InjectRepository(CandidateDocument)
    private readonly documentRepo: Repository<CandidateDocument>,
    @InjectRepository(CandidateSummary)
    private readonly summaryRepo: Repository<CandidateSummary>,
    @Inject(SUMMARIZATION_PROVIDER)
    private readonly summarizationProvider: SummarizationProvider,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name !== "summarize-candidate") {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return;
    }

    const { summaryId, candidateId, workspaceId } = job.data as {
      summaryId: string;
      candidateId: string;
      workspaceId: string;
    };

    this.logger.log(
      `Processing summary ${summaryId} for candidate ${candidateId} in workspace ${workspaceId}`,
    );

    // Attempt to mark as IN_PROGRESS to avoid double processing (BullMQ handles retries,
    // but we still want to update our status)
    await this.summaryRepo.update(
      { id: summaryId },
      { status: SummaryStatus.IN_PROGRESS },
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
      throw error; // Rethrow to let BullMQ handle retry if configured
    }
  }
}
