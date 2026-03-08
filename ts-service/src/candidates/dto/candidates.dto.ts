import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UploadCandidateDocumentDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  documentType!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(512)
  storageKey!: string;

  @IsNotEmpty()
  @IsString()
  rawText!: string;
}

export class GenerateSummaryDto {
  // candidateId is in URL
}
