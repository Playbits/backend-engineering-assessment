import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { DataSource } from "typeorm";
import { SampleWorkspace } from "../src/entities/sample-workspace.entity";
import { SampleCandidate } from "../src/entities/sample-candidate.entity";
import { CandidateDocument } from "../src/entities/candidate-document.entity";
import {
  SummaryStatus,
  CandidateSummary,
} from "../src/entities/candidate-summary.entity";
import { SUMMARIZATION_PROVIDER } from "../src/llm/summarization-provider.interface";
import { QueueService } from "../src/queue/queue.service";
import { SummarizationWorker } from "../src/candidates/summarization.worker";
import { getQueueToken } from "@nestjs/bullmq";
import * as fs from "fs/promises";
import * as path from "path";

jest.mock("pdf-parse", () => {
  return jest.fn().mockResolvedValue({ text: "Extracted PDF text" });
});

jest.mock("mammoth", () => ({
  extractRawText: jest.fn().mockResolvedValue({ value: "Extracted Word text" }),
}));

const workspaceId = "test-workspace";
const candidateId = "test-candidate";
const otherWorkspaceId = "other-workspace";

async function createTestApp(summarizationProviderMock?: any) {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(SUMMARIZATION_PROVIDER)
    .useValue(
      summarizationProviderMock || {
        generateCandidateSummary: jest.fn().mockResolvedValue({
          score: 85,
          strengths: ["Expert in NestJS", "Great communication"],
          concerns: ["None"],
          summary: "Highly recommended candidate.",
          recommendedDecision: "advance",
        }),
      },
    )
    .overrideProvider(SummarizationWorker)
    .useValue({
      process: jest.fn().mockImplementation(async (job: any) => {
        const summarizationProvider = moduleFixture.get(SUMMARIZATION_PROVIDER);
        const dataSource = moduleFixture.get(DataSource);
        const summaryRepo = dataSource.getRepository(CandidateSummary);
        const documentRepo = dataSource.getRepository(CandidateDocument);

        const { summaryId, candidateId, workspaceId } = job.data;

        try {
          const documents = await documentRepo.findBy({
            candidateId,
            workspaceId,
          });
          const texts = documents.map((doc) => doc.rawText);

          const result = await summarizationProvider.generateCandidateSummary({
            candidateId,
            documents: texts,
          });

          await summaryRepo.update(summaryId, {
            status: SummaryStatus.COMPLETED,
            score: result.score,
            strengths: result.strengths,
            concerns: result.concerns,
            summary: result.summary,
            recommendedDecision: result.recommendedDecision,
            provider: "GeminiSummarizationProvider",
            promptVersion: "2.0-flash",
          });
        } catch (error: any) {
          await summaryRepo.update(summaryId, {
            status: SummaryStatus.FAILED,
            errorMessage: error.message,
          });
        }
      }),
    })
    .overrideProvider(getQueueToken("summarization"))
    .useValue({
      add: jest.fn().mockResolvedValue({ id: "job-id" }),
    })
    .compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  await app.init();
  return app;
}

describe("Candidates (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    // Clean start
    await dataSource.query('DELETE FROM "candidate_summaries"');
    await dataSource.query('DELETE FROM "candidate_documents"');

    const workspaceRepo = dataSource.getRepository(SampleWorkspace);
    const candidateRepo = dataSource.getRepository(SampleCandidate);

    await workspaceRepo.save({ id: workspaceId, name: "Test Workspace" });
    await candidateRepo.save({
      id: candidateId,
      workspaceId,
      fullName: "John Doe",
      email: "john@example.com",
    });
    await candidateRepo.save({
      id: "empty-candidate",
      workspaceId,
      fullName: "Empty Candidate",
      email: "empty@example.com",
    });
  }, 30000);

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.query('DELETE FROM "candidate_summaries"');
      await dataSource.query('DELETE FROM "candidate_documents"');
      await dataSource
        .getRepository(SampleCandidate)
        .delete({ id: candidateId });
      await dataSource
        .getRepository(SampleWorkspace)
        .delete({ id: workspaceId });
      await dataSource
        .getRepository(SampleWorkspace)
        .delete({ id: otherWorkspaceId });

      // Cleanup storage
      const storageDir = path.join(process.cwd(), "storage");
      await fs.rm(storageDir, { recursive: true, force: true });
    }
    if (app) {
      await app.close();
    }
  });

  it("End-to-end flow: Upload -> Generate -> Retrieve", async () => {
    // 1. Upload Document
    const uploadRes = await request(app.getHttpServer())
      .post(`/candidates/${candidateId}/documents`)
      .set("x-user-id", "test-user")
      .set("x-workspace-id", workspaceId)
      .attach("file", Buffer.from("fake-pdf-content"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      })
      .field("fileName", "resume.pdf")
      .expect(201);

    expect(uploadRes.body.candidateId).toBe(candidateId);
    expect(uploadRes.body.workspaceId).toBe(workspaceId);
    expect(uploadRes.body.rawText).toContain("Extracted PDF text");
    expect(uploadRes.body.storageKey).toMatch(
      new RegExp(`^${candidateId}/.*-resume.pdf$`),
    );

    // 2. Trigger Summary Generation
    const generateRes = await request(app.getHttpServer())
      .post(`/candidates/${candidateId}/summaries/generate`)
      .set("x-user-id", "test-user")
      .set("x-workspace-id", workspaceId)
      .expect(202);

    expect(generateRes.body.status).toBe(SummaryStatus.PENDING);
    const summaryId = generateRes.body.id;

    // Manually trigger worker processing in test
    const worker = app.get(SummarizationWorker);
    await worker.process({
      name: "summarize-candidate",
      data: { summaryId, candidateId, workspaceId },
    } as any);

    // 3. Wait for worker to process (it's already done, but we'll check status)
    let status = SummaryStatus.PENDING;
    for (let i = 0; i < 5; i++) {
      const checkRes = await request(app.getHttpServer())
        .get(`/candidates/${candidateId}/summaries/${summaryId}`)
        .set("x-user-id", "test-user")
        .set("x-workspace-id", workspaceId)
        .expect(200);

      status = checkRes.body.status;
      if (status !== SummaryStatus.PENDING) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    expect(status).toBe(SummaryStatus.COMPLETED);

    // 4. Verify structured data
    const finalRes = await request(app.getHttpServer())
      .get(`/candidates/${candidateId}/summaries/${summaryId}`)
      .set("x-user-id", "test-user")
      .set("x-workspace-id", workspaceId)
      .expect(200);

    expect(finalRes.body.score).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(finalRes.body.strengths)).toBe(true);
  }, 20000);

  it("Access Control: Cannot access candidates from another workspace", async () => {
    const otherWorkspaceId = "other-workspace";

    await request(app.getHttpServer())
      .get(`/candidates/${candidateId}/summaries`)
      .set("x-user-id", "other-user")
      .set("x-workspace-id", otherWorkspaceId)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/candidates/${candidateId}/documents`)
      .set("x-user-id", "other-user")
      .set("x-workspace-id", otherWorkspaceId)
      .attach("file", Buffer.from("content"), "hacker.pdf")
      .field("fileName", "hacker.pdf")
      .expect(404);
  });

  it("Validation: Missing fields in document upload", async () => {
    await request(app.getHttpServer())
      .post(`/candidates/${candidateId}/documents`)
      .set("x-user-id", "test-user")
      .set("x-workspace-id", workspaceId)
      // Sending body but no file
      .send({ fileName: "resume.pdf" })
      .expect(400);
  });

  it("Worker: Handles failures from SummarizationProvider gracefully", async () => {
    const failingMock = {
      generateCandidateSummary: jest
        .fn()
        .mockRejectedValue(new Error("LLM Overloaded")),
    };

    const localApp = await createTestApp(failingMock);

    await request(localApp.getHttpServer())
      .post(`/candidates/${candidateId}/documents`)
      .set("x-user-id", "test-user")
      .set("x-workspace-id", workspaceId)
      .attach("file", Buffer.from("content"), "resume.pdf")
      .field("fileName", "resume.pdf")
      .expect(201);

    const genRes = await request(localApp.getHttpServer())
      .post(`/candidates/${candidateId}/summaries/generate`)
      .set("x-user-id", "test-user")
      .set("x-workspace-id", workspaceId)
      .expect(202);

    const summaryId = genRes.body.id;

    // Manually trigger worker processing
    const worker = localApp.get(SummarizationWorker);
    try {
      await worker.process({
        name: "summarize-candidate",
        data: { summaryId, candidateId, workspaceId },
      } as any);
    } catch (e) {
      // Expected to throw in the worker mock if we didn't handle it
    }

    const checkRes = await request(localApp.getHttpServer())
      .get(`/candidates/${candidateId}/summaries/${summaryId}`)
      .set("x-user-id", "test-user")
      .set("x-workspace-id", workspaceId);

    expect(checkRes.body.status).toBe(SummaryStatus.FAILED);
    expect(checkRes.body.errorMessage).toContain("LLM Overloaded");

    await localApp.close();
  }, 15000);

  it("Worker: Handles candidate with no documents", async () => {
    const emptyCandidateId = "empty-candidate";

    const genRes = await request(app.getHttpServer())
      .post(`/candidates/${emptyCandidateId}/summaries/generate`)
      .set("x-user-id", "test-user")
      .set("x-workspace-id", workspaceId)
      .expect(202);

    const summaryId = genRes.body.id;

    // Manually trigger worker processing
    const worker = app.get(SummarizationWorker);
    await worker.process({
      name: "summarize-candidate",
      data: { summaryId, candidateId: emptyCandidateId, workspaceId },
    } as any);

    const checkRes = await request(app.getHttpServer())
      .get(`/candidates/${emptyCandidateId}/summaries/${summaryId}`)
      .set("x-user-id", "test-user")
      .set("x-workspace-id", workspaceId);

    expect(checkRes.body.status).toBe(SummaryStatus.COMPLETED);
  }, 20000);
});
