import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { SampleWorkspace } from '../src/entities/sample-workspace.entity';
import { SampleCandidate } from '../src/entities/sample-candidate.entity';
import { CandidateDocument } from '../src/entities/candidate-document.entity';
import { SummaryStatus } from '../src/entities/candidate-summary.entity';
import { SUMMARIZATION_PROVIDER } from '../src/llm/summarization-provider.interface';

describe('Candidates (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const workspaceId = 'test-workspace';
  const candidateId = 'test-candidate';
  const otherWorkspaceId = 'other-workspace';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SUMMARIZATION_PROVIDER)
      .useValue({
        generateCandidateSummary: jest.fn().mockResolvedValue({
          score: 85,
          strengths: ['Expert in NestJS', 'Great communication'],
          concerns: ['None'],
          summary: 'Highly recommended candidate.',
          recommendedDecision: 'advance',
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    dataSource = app.get(DataSource);
    
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    // Clean start
    await dataSource.query('DELETE FROM "candidate_summaries"');
    await dataSource.query('DELETE FROM "candidate_documents"');

    const workspaceRepo = dataSource.getRepository(SampleWorkspace);
    const candidateRepo = dataSource.getRepository(SampleCandidate);

    await workspaceRepo.save({ id: workspaceId, name: 'Test Workspace' });
    await candidateRepo.save({ id: candidateId, workspaceId, fullName: 'John Doe', email: 'john@example.com' });
  }, 30000);

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.query('DELETE FROM "candidate_summaries"');
      await dataSource.query('DELETE FROM "candidate_documents"');
      await dataSource.getRepository(SampleCandidate).delete({ id: candidateId });
      await dataSource.getRepository(SampleWorkspace).delete({ id: workspaceId });
      await dataSource.getRepository(SampleWorkspace).delete({ id: otherWorkspaceId });
    }
    if (app) {
      await app.close();
    }
  });

  it('End-to-end flow: Upload -> Generate -> Retrieve', async () => {
    // 1. Upload Document
    const uploadRes = await request(app.getHttpServer())
      .post(`/candidates/${candidateId}/documents`)
      .set('x-user-id', 'test-user')
      .set('x-workspace-id', workspaceId)
      .send({
        documentType: 'resume',
        fileName: 'resume.txt',
        storageKey: 'resumes/john_doe.txt',
        rawText: 'John is a great engineer with 5 years of NestJS experience.',
      })
      .expect(201);

    expect(uploadRes.body.candidateId).toBe(candidateId);
    expect(uploadRes.body.workspaceId).toBe(workspaceId);

    // 2. Trigger Summary Generation
    const generateRes = await request(app.getHttpServer())
      .post(`/candidates/${candidateId}/summaries/generate`)
      .set('x-user-id', 'test-user')
      .set('x-workspace-id', workspaceId)
      .expect(201);

    expect(generateRes.body.status).toBe(SummaryStatus.PENDING);
    const summaryId = generateRes.body.id;

    // 3. Wait for worker to process
    let status = SummaryStatus.PENDING;
    for (let i = 0; i < 15; i++) {
       await new Promise(resolve => setTimeout(resolve, 1000));
       try {
         const checkRes = await request(app.getHttpServer())
           .get(`/candidates/${candidateId}/summaries/${summaryId}`)
           .set('x-user-id', 'test-user')
           .set('x-workspace-id', workspaceId)
           .expect(200);
         
         status = checkRes.body.status;
         if (status !== SummaryStatus.PENDING) break;
       } catch (err: any) {
         if (err.message && err.message.includes('Driver not Connected')) break;
         throw err;
       }
    }

    if (status === SummaryStatus.FAILED) {
        const finalRes = await request(app.getHttpServer())
          .get(`/candidates/${candidateId}/summaries/${summaryId}`)
          .set('x-user-id', 'test-user')
          .set('x-workspace-id', workspaceId);
        throw new Error(`Summary failed: ${finalRes.body.errorMessage}`);
    }
    
    expect(status).toBe(SummaryStatus.COMPLETED);

    // 4. Verify structured data
    const finalRes = await request(app.getHttpServer())
      .get(`/candidates/${candidateId}/summaries/${summaryId}`)
      .set('x-user-id', 'test-user')
      .set('x-workspace-id', workspaceId)
      .expect(200);

    expect(finalRes.body.score).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(finalRes.body.strengths)).toBe(true);
  }, 20000);

  it('Access Control: Cannot access candidates from another workspace', async () => {
    const otherWorkspaceId = 'other-workspace';
    
    await request(app.getHttpServer())
      .get(`/candidates/${candidateId}/summaries`)
      .set('x-user-id', 'other-user')
      .set('x-workspace-id', otherWorkspaceId)
      .expect(200)
      .expect([]);
      
    await request(app.getHttpServer())
      .post(`/candidates/${candidateId}/documents`)
      .set('x-user-id', 'other-user')
      .set('x-workspace-id', otherWorkspaceId)
      .send({
        documentType: 'resume',
        fileName: 'hacker.txt',
        storageKey: 'resumes/hacker.txt',
        rawText: 'I am trying to upload to john...',
      })
      .expect(201);
      
    const johnDocs = await dataSource.getRepository(CandidateDocument).find({
        where: { candidateId, workspaceId: otherWorkspaceId }
    });
    expect(johnDocs.length).toBe(1);
    expect(johnDocs[0].workspaceId).toBe(otherWorkspaceId);
  });

  it('Validation: Missing fields in document upload', async () => {
    await request(app.getHttpServer())
      .post(`/candidates/${candidateId}/documents`)
      .set('x-user-id', 'test-user')
      .set('x-workspace-id', workspaceId)
      .send({
        documentType: 'resume',
      })
      .expect(400);
  });

  it('Worker: Handles failures from SummarizationProvider gracefully', async () => {
    const failingMock = {
      generateCandidateSummary: jest.fn().mockRejectedValue(new Error('LLM Overloaded')),
    };
    
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(SUMMARIZATION_PROVIDER)
    .useValue(failingMock)
    .compile();
    
    const localApp = moduleFixture.createNestApplication();
    await localApp.init();
    
    await request(localApp.getHttpServer())
      .post(`/candidates/${candidateId}/documents`)
      .set('x-user-id', 'test-user')
      .set('x-workspace-id', workspaceId)
      .send({
        documentType: 'resume',
        fileName: 'resume.txt',
        storageKey: 'key',
        rawText: 'Text',
      })
      .expect(201);
      
    const genRes = await request(localApp.getHttpServer())
      .post(`/candidates/${candidateId}/summaries/generate`)
      .set('x-user-id', 'test-user')
      .set('x-workspace-id', workspaceId)
      .expect(201);
      
    const summaryId = genRes.body.id;
    
    let status = SummaryStatus.PENDING;
    for (let i = 0; i < 10; i++) {
       await new Promise(resolve => setTimeout(resolve, 1000));
       const checkRes = await request(localApp.getHttpServer())
         .get(`/candidates/${candidateId}/summaries/${summaryId}`)
         .set('x-user-id', 'test-user')
         .set('x-workspace-id', workspaceId);
       status = checkRes.body.status;
       if (status === SummaryStatus.FAILED) break;
    }
    
    expect(status).toBe(SummaryStatus.FAILED);
    const finalRes = await request(localApp.getHttpServer())
      .get(`/candidates/${candidateId}/summaries/${summaryId}`)
      .set('x-user-id', 'test-user')
      .set('x-workspace-id', workspaceId);
    expect(finalRes.body.errorMessage).toContain('LLM Overloaded');
    
    await localApp.close();
  }, 15000);

  it('Worker: Handles candidate with no documents', async () => {
    const emptyCandidateId = 'empty-candidate';
    
    const genRes = await request(app.getHttpServer())
      .post(`/candidates/${emptyCandidateId}/summaries/generate`)
      .set('x-user-id', 'test-user')
      .set('x-workspace-id', workspaceId)
      .expect(201);
      
    const summaryId = genRes.body.id;
    
    let status = SummaryStatus.PENDING;
    for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const checkRes = await request(app.getHttpServer())
          .get(`/candidates/${emptyCandidateId}/summaries/${summaryId}`)
          .set('x-user-id', 'test-user')
          .set('x-workspace-id', workspaceId);
        status = checkRes.body.status;
        if (status !== SummaryStatus.PENDING) break;
    }
    
    expect(status).toBe(SummaryStatus.COMPLETED);
  }, 20000);
});
