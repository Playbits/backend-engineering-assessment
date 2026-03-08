import { Module } from '@nestjs/common';

import { GeminiSummarizationProvider } from './gemini-summarization.provider';
import { SUMMARIZATION_PROVIDER } from './summarization-provider.interface';

@Module({
  providers: [
    GeminiSummarizationProvider,
    {
      provide: SUMMARIZATION_PROVIDER,
      useExisting: GeminiSummarizationProvider,
    },
  ],
  exports: [SUMMARIZATION_PROVIDER, GeminiSummarizationProvider],
})
export class LlmModule {}
