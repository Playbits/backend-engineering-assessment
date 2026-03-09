# Usage & Integration Guide

This guide explains how to set up, run, and test the integrated backend system.

## Prerequisites

- **Docker & Docker Compose**
- **Node.js** (v18+ recommended)
- **pnpm** (preferred) or npm
- **Python 3.10+** (for Python service)
- **Google Gemini API Key** (for real AI summaries)

## 1. Infrastructure Setup

Start the database and Redis services using Docker:

```bash
docker-compose up -d
```

This will start:

- **PostgreSQL** on port `5432`
- **Redis** on port `6379`

## 2. Python Service (Part A)

### Setup

1. Navigate to the directory: `cd python-service`
2. Create a virtual environment: `python3.12 -m venv venv && source venv/bin/activate`
3. Install dependencies: `pip install -r requirements.txt`
4. Configure environment: `cp .env.example .env`
5. Run migrations: `python3.12 app/db/run_migrations.py`

### Running the App

```bash
python3.12 -m uvicorn app.main:app --reload --port 8000
```

### API Usage

- **Create Briefing**: `POST /briefings`
- **Get HTML Report**: `GET /briefings/:id/report`

---

## 3. TypeScript Service (Part B)

### Setup

1. Navigate to the directory: `cd ts-service`
2. Install dependencies: `pnpm install`
3. Configure environment: `cp .env.example .env` and add your `GEMINI_API_KEY`.
4. Run migrations: `pnpm run migration:run`

### Running the App

```bash
pnpm run start:dev
```

### API Usage Flow

#### A. Upload a Document

Upload a PDF or Word file for a candidate.

- **Endpoint**: `POST /candidates/:candidateId/documents`
- **Headers**:
  - `x-user-id`: `user-1`
  - `x-workspace-id`: `workspace-1`
- **Body (form-data)**:
  - `file`: (The binary file)
  - `fileName`: `resume.pdf`

#### B. Trigger Summary Generation

Queue the background job for summarization.

- **Endpoint**: `POST /candidates/:candidateId/summaries/generate`
- **Response**: `202 Accepted`

#### C. List & Retrieve Summaries

- **List All**: `GET /candidates/:candidateId/summaries`
- **Get Specific**: `GET /candidates/:candidateId/summaries/:summaryId`

### Testing

Run the comprehensive e2e test suite:

```bash
pnpm test
```

## 4. Key Integration Features

### Automated Extraction

You no longer need to provide `rawText` manually. The system automatically parses uploaded files using `pdf-parse` and `mammoth` and stores the text for the AI.

### Reliable Queuing

All heavy AI processing is handled by **BullMQ**. If the Gemini API is down or rate-limited, the job will automatically retry with exponential backoff.

### Multi-tenant Security

All data is siloed by `workspaceId`. Attempting to access or upload documents to a candidate in a different workspace will result in a `404 Not Found` error.
