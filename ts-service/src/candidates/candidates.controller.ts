import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CandidatesService } from "./candidates.service";
import { UploadCandidateDocumentDto } from "./dto/candidates.dto";
import { FakeAuthGuard } from "../auth/fake-auth.guard";
import { CurrentUser } from "../auth/auth-user.decorator";
import { AuthUser } from "../auth/auth.types";
import * as mammoth from "mammoth";
import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import { ConfigService } from "@nestjs/config";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require("pdf-parse");

@Controller("candidates")
@UseGuards(FakeAuthGuard)
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly configService: ConfigService,
  ) {}

  @Post(":candidateId/documents")
  @UseInterceptors(FileInterceptor("file"))
  async uploadDocument(
    @CurrentUser() user: AuthUser,
    @Param("candidateId") candidateId: string,
    @Body() dto: UploadCandidateDocumentDto,
    @UploadedFile() file?: any,
  ) {
    if (!file) {
      throw new BadRequestException("File is required");
    }

    const allowedMimetypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];

    if (!allowedMimetypes.includes(file.mimetype)) {
      throw new BadRequestException(
        "Invalid file type. Only PDF and MS Word documents are allowed.",
      );
    }

    // Extract text
    let extractedText = "";
    if (file.mimetype === "application/pdf") {
      try {
        const data = await pdf(file.buffer);
        extractedText = data.text;
      } catch (err) {
        throw new BadRequestException("Failed to extract text from PDF");
      }
    } else {
      // Word document
      try {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = result.value;
      } catch (err) {
        throw new BadRequestException(
          "Failed to extract text from Word document",
        );
      }
    }

    dto.rawText = extractedText;

    // Use originalname if fileName is not provided
    if (!dto.fileName) {
      dto.fileName = file.originalname;
    }

    // Infer documentType if not provided
    if (!dto.documentType) {
      dto.documentType = file.mimetype === "application/pdf" ? "pdf" : "word";
    }

    // Save file locally
    const storageDir =
      this.configService.get<string>("STORAGE_DIR") || "storage/documents";
    const absoluteStorageDir = path.isAbsolute(storageDir)
      ? storageDir
      : path.join(process.cwd(), storageDir);

    // Ensure directory exists
    await fs.mkdir(absoluteStorageDir, { recursive: true });

    const fileId = randomUUID();
    const relativePath = path.join(candidateId, `${fileId}-${dto.fileName}`);
    const absolutePath = path.join(absoluteStorageDir, relativePath);

    // Ensure candidate sub-directory exists
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    // Write file
    await fs.writeFile(absolutePath, file.buffer);

    // Set storageKey to the relative path within storageDir
    dto.storageKey = relativePath;

    return this.candidatesService.uploadDocument(
      user.workspaceId,
      candidateId,
      dto,
    );
  }

  @Post(":candidateId/summaries/generate")
  @HttpCode(HttpStatus.ACCEPTED)
  async generateSummary(
    @CurrentUser() user: AuthUser,
    @Param("candidateId") candidateId: string,
  ) {
    return this.candidatesService.generateSummary(
      user.workspaceId,
      candidateId,
    );
  }

  @Get(":candidateId/summaries")
  async listSummaries(
    @CurrentUser() user: AuthUser,
    @Param("candidateId") candidateId: string,
  ) {
    return this.candidatesService.listSummaries(user.workspaceId, candidateId);
  }

  @Get(":candidateId/summaries/:summaryId")
  async getSummary(
    @CurrentUser() user: AuthUser,
    @Param("candidateId") candidateId: string,
    @Param("summaryId") summaryId: string,
  ) {
    return this.candidatesService.getSummary(
      user.workspaceId,
      candidateId,
      summaryId,
    );
  }
}
