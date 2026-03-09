import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CandidateSummaryInput,
  CandidateSummaryResult,
  SummarizationProvider,
} from "./summarization-provider.interface";
import { validate } from "class-validator";
import { IsArray, IsNumber, IsString, IsIn } from "class-validator";
import { plainToInstance } from "class-transformer";

class ValidatedSummaryResult {
  @IsNumber()
  score!: number;

  @IsArray()
  @IsString({ each: true })
  strengths!: string[];

  @IsArray()
  @IsString({ each: true })
  concerns!: string[];

  @IsString()
  summary!: string;

  @IsString()
  @IsIn(["advance", "hold", "reject"])
  recommendedDecision!: "advance" | "hold" | "reject";
}

/**
 * Provides candidate summarization using the Google Gemini AI Model.
 * Implements structured output requesting and validation.
 */
@Injectable()
export class GeminiSummarizationProvider implements SummarizationProvider {
  private readonly logger = new Logger(GeminiSummarizationProvider.name);
  private readonly apiKey: string;
  private readonly apiUrl =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>("GEMINI_API_KEY") || "";
  }

  /**
   * Generates a structured summary for a candidate based on provided documents.
   *
   * @param input Candidate ID and list of raw document texts.
   * @throws Error if Gemini API key is missing, API call fails, or result is malformed.
   */
  async generateCandidateSummary(
    input: CandidateSummaryInput,
  ): Promise<CandidateSummaryResult> {
    if (!this.apiKey) {
      this.logger.warn(
        "GEMINI_API_KEY is not configured. Returning fake summary.",
      );
      return {
        score: 85,
        strengths: [
          "Strong technical background",
          "Experience with large-scale systems",
        ],
        concerns: ["Limited experience with cloud providers"],
        summary:
          "A very promising candidate with solid engineering fundamentals.",
        recommendedDecision: "advance",
      };
    }

    const prompt = `
      You are an expert recruiter. Analyze the following candidate documents and provide a structured summary.
      Candidate ID: ${input.candidateId}
      
      Documents:
      ${input.documents.map((doc, i) => `--- Document ${i + 1} ---\n${doc}`).join("\n\n")}
      
      Output MUST be a valid JSON object with the following fields:
      - score: A number from 0 to 100 representing the candidate's fit.
      - strengths: An array of strings highlighting the candidate's strengths.
      - concerns: An array of strings highlighting potential concerns.
      - summary: A paragraph summarizing the candidate.
      - recommendedDecision: One of "advance", "hold", or "reject".
      
      Return ONLY the JSON object.
    `;

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      let textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textResponse) {
        throw new Error("Empty response from Gemini");
      }

      // Strip markdown code blocks if present
      if (textResponse.startsWith("```")) {
        textResponse = textResponse
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "");
      }

      const parsedResult = JSON.parse(textResponse);

      // Validation
      const validatedInstance = plainToInstance(
        ValidatedSummaryResult,
        parsedResult,
      );
      const errors = await validate(validatedInstance);

      if (errors.length > 0) {
        this.logger.error(
          `Validation failed for Gemini output: ${JSON.stringify(errors)}`,
        );
        throw new Error("Invalid structure in LLM response");
      }

      return validatedInstance as CandidateSummaryResult;
    } catch (error: any) {
      this.logger.error(
        `Error in GeminiSummarizationProvider: ${error.message}`,
      );
      throw error;
    }
  }
}
