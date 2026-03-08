import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { UploadCandidateDocumentDto } from './dto/candidates.dto';
import { FakeAuthGuard } from '../auth/fake-auth.guard';
import { CurrentUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth.types';

@Controller('candidates')
@UseGuards(FakeAuthGuard)
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Post(':candidateId/documents')
  async uploadDocument(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
    @Body() dto: UploadCandidateDocumentDto,
  ) {
    return this.candidatesService.uploadDocument(user.workspaceId, candidateId, dto);
  }

  @Post(':candidateId/summaries/generate')
  async generateSummary(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
  ) {
    return this.candidatesService.generateSummary(user.workspaceId, candidateId);
  }

  @Get(':candidateId/summaries')
  async listSummaries(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
  ) {
    return this.candidatesService.listSummaries(user.workspaceId, candidateId);
  }

  @Get(':candidateId/summaries/:summaryId')
  async getSummary(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
    @Param('summaryId') summaryId: string,
  ) {
    return this.candidatesService.getSummary(user.workspaceId, candidateId, summaryId);
  }
}
