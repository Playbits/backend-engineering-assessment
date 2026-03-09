import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CandidateDocument } from "../entities/candidate-document.entity";
import {
  CandidateSummary,
  SummaryStatus,
} from "../entities/candidate-summary.entity";
import { SampleCandidate } from "../entities/sample-candidate.entity";
import { QueueService } from "../queue/queue.service";
import { UploadCandidateDocumentDto } from "./dto/candidates.dto";

@Injectable()
export class CandidatesService {
  constructor(
    @InjectRepository(CandidateDocument)
    private readonly documentRepo: Repository<CandidateDocument>,
    @InjectRepository(CandidateSummary)
    private readonly summaryRepo: Repository<CandidateSummary>,
    @InjectRepository(SampleCandidate)
    private readonly candidateRepo: Repository<SampleCandidate>,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Ensures the candidate exists and belongs to the specified workspace.
   */
  private async ensureCandidateExists(
    workspaceId: string,
    candidateId: string,
  ): Promise<void> {
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId, workspaceId },
    });

    if (!candidate) {
      throw new NotFoundException(
        `Candidate ${candidateId} not found in workspace ${workspaceId}`,
      );
    }
  }

  /**
   * Stores a new document associated with a candidate.
   * Ensures the document belongs to the specified workspace for multi-tenant isolation.
   */
  async uploadDocument(
    workspaceId: string,
    candidateId: string,
    dto: UploadCandidateDocumentDto,
  ): Promise<CandidateDocument> {
    await this.ensureCandidateExists(workspaceId, candidateId);

    const document = this.documentRepo.create({
      candidateId,
      workspaceId,
      ...dto,
    });
    return this.documentRepo.save(document);
  }

  /**
   * Creates a pending summary record and triggers the asynchronous summarization job.
   */
  async generateSummary(
    workspaceId: string,
    candidateId: string,
  ): Promise<CandidateSummary> {
    await this.ensureCandidateExists(workspaceId, candidateId);

    // 1. Create a pending summary record
    const summary = this.summaryRepo.create({
      candidateId,
      workspaceId,
      status: SummaryStatus.PENDING,
    });
    const savedSummary = await this.summaryRepo.save(summary);

    // 2. Enqueue the background job
    await this.queueService.enqueue("summarize-candidate", {
      summaryId: savedSummary.id,
      candidateId,
      workspaceId,
    });

    return savedSummary;
  }

  /**
   * Lists all summaries generated for a specific candidate within a workspace.
   */
  async listSummaries(
    workspaceId: string,
    candidateId: string,
  ): Promise<CandidateSummary[]> {
    await this.ensureCandidateExists(workspaceId, candidateId);

    return this.summaryRepo.find({
      where: { candidateId, workspaceId },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Fetches a single candidate summary by its ID.
   * Enforces cross-tenant security by checking both workspaceId and candidateId.
   */
  async getSummary(
    workspaceId: string,
    candidateId: string,
    summaryId: string,
  ): Promise<CandidateSummary> {
    const summary = await this.summaryRepo.findOne({
      where: { id: summaryId, candidateId, workspaceId },
    });

    if (!summary) {
      throw new NotFoundException(
        `Summary ${summaryId} not found for candidate ${candidateId}`,
      );
    }

    return summary;
  }
}
