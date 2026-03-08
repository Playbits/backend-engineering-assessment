import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary, SummaryStatus } from '../entities/candidate-summary.entity';
import { QueueService } from '../queue/queue.service';
import { UploadCandidateDocumentDto } from './dto/candidates.dto';

@Injectable()
export class CandidatesService {
  constructor(
    @InjectRepository(CandidateDocument)
    private readonly documentRepo: Repository<CandidateDocument>,
    @InjectRepository(CandidateSummary)
    private readonly summaryRepo: Repository<CandidateSummary>,
    private readonly queueService: QueueService,
  ) {}

  async uploadDocument(workspaceId: string, candidateId: string, dto: UploadCandidateDocumentDto): Promise<CandidateDocument> {
    const document = this.documentRepo.create({
      candidateId,
      workspaceId,
      ...dto,
    });
    return this.documentRepo.save(document);
  }

  async generateSummary(workspaceId: string, candidateId: string): Promise<CandidateSummary> {
    // 1. Create a pending summary record
    const summary = this.summaryRepo.create({
      candidateId,
      workspaceId,
      status: SummaryStatus.PENDING,
    });
    const savedSummary = await this.summaryRepo.save(summary);

    // 2. Enqueue the background job
    this.queueService.enqueue('summarize-candidate', {
      summaryId: savedSummary.id,
      candidateId,
      workspaceId,
    });

    return savedSummary;
  }

  async listSummaries(workspaceId: string, candidateId: string): Promise<CandidateSummary[]> {
    return this.summaryRepo.find({
      where: { candidateId, workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async getSummary(workspaceId: string, candidateId: string, summaryId: string): Promise<CandidateSummary> {
    const summary = await this.summaryRepo.findOne({
      where: { id: summaryId, candidateId, workspaceId },
    });

    if (!summary) {
      throw new NotFoundException(`Summary ${summaryId} not found for candidate ${candidateId}`);
    }

    return summary;
  }
}
