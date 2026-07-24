import 'server-only';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { AnalysisSchema, type AnalysisOutput } from './schema';
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from './prompt';

const nvidiaProvider = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = 'minimaxai/minimax-m3';

export interface AnalyzeToolResult {
  success: boolean;
  analysis?: AnalysisOutput;
  error?: string;
  toolId: string;
}

export async function analyzeTool(
  toolId: string,
  toolName: string,
  rawText: string
): Promise<AnalyzeToolResult> {
  if (!rawText || rawText.trim().length === 0) {
    return { success: false, error: 'No raw text available for analysis', toolId };
  }

  if (!process.env.OPENAI_API_KEY) {
    return { success: false, error: 'OPENAI_API_KEY environment variable is not set', toolId };
  }

  let lastError: string | undefined;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { object } = await generateObject({
        model: nvidiaProvider.chat(MODEL),
        schema: AnalysisSchema,
        instructions: ANALYSIS_SYSTEM_PROMPT,
        prompt: buildAnalysisPrompt(toolName, rawText),
        temperature: 0.3,
        maxOutputTokens: 4096,
      });

      return { success: true, analysis: object as AnalysisOutput, toolId };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error during AI analysis';

      if (attempt === 1) {
        console.warn(`  ⚠️  [Analysis] Attempt 1 failed for "${toolName}": ${lastError}. Retrying...`);
      } else {
        console.error(`  ❌ [Analysis] Attempt 2 failed for "${toolName}": ${lastError}`);
      }
    }
  }

  return { success: false, error: lastError || 'Analysis failed after 2 attempts', toolId };
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const baseURL = process.env.OPENAI_BASE_URL || 'https://integrate.api.nvidia.com/v1';
  const url = `${baseURL}/embeddings`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nvidia/nv-embedqa-e5-v5',
        input: text,
        input_type: 'passage',
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`NVIDIA embedding API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const embedding: number[] = result.data?.[0]?.embedding;

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding response from NVIDIA API');
    }

    console.log(`  🧠 [Embedding] Generated embedding (${embedding.length} dimensions)`);
    return embedding;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown embedding error';
    console.error(`  ❌ [Embedding] Failed to generate embedding: ${errorMsg}`);
    throw error;
  }
}
