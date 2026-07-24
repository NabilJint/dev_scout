# Implementation Prompt: AI Analysis Pipeline for DevScout AI

## Goal

Implement the AI analysis pipeline for DevScout AI — a Next.js 16 (app router) project that analyzes scraped developer tool data using the NVIDIA API (OpenAI-compatible) via the Vercel AI SDK, validates structured output with Zod, stores analysis results in Supabase, and exposes a single `POST /api/analyze` API route for manual triggering.

**Note**: This prompt ONLY covers the AI analysis pipeline. pgvector embeddings and Related Tools (AGENTS.md §20) are NOT included — they are implemented in a separate prompt after this one is working.

---

## Assigned Specialist Agent(s)

| Agent | Role |
|-------|------|
| **AI/ML Engineer** (primary) | Implements all `lib/analyze/` modules — Zod schema, prompt templates, single-tool analysis function, batch orchestrator |
| **Backend Engineer** | Implements `POST /api/analyze` route, updates `getPendingAnalysisTools` query |
| **Database Engineer** | Reviews the `getPendingAnalysisTools` query update to ensure it returns full tool data including `raw_text` |
| **Security Engineer** | Reviews admin secret handling, API key usage (NVIDIA key stored as `OPENAI_API_KEY`) |
| **Code Reviewer** | Reviews all diffs before merge |
| **QA Engineer** | Runs `typecheck`, `lint`; provides test commands |

---

## Skills Read

- `.agents/skills/ai-sdk` — Vercel AI SDK usage patterns: `generateObject` for structured output, `createOpenAI` for custom provider setup, `@ai-sdk/openai` provider with custom `baseURL`, Zod schema integration
- `.agents/skills/supabase` — Supabase client creation, service role usage, query patterns, LEFT JOIN for pending analysis detection, joined table filter gotcha
- `node_modules/next/dist/docs/` — Next.js 16 API route patterns, route handlers, server-only modules

---

## Existing Code Inspected

| File | Key Findings |
|------|--------------|
| `lib/supabase/types.ts` | All types defined: `Tool`, `ToolAnalysis`, `InsertAnalysisParams` — `subtitle` field exists on `ToolAnalysis` and `InsertAnalysisParams` |
| `lib/supabase/queries/analyses.ts` | `insertAnalysis()`, `upsertAnalysis()`, `updateAnalysis()` — all exist with validation of percentages sum to 100 and `complexity_score` formula |
| `lib/supabase/queries/tools.ts` | `getPendingAnalysisTools()` currently only selects `id` — needs update to also select `name`, `raw_text`, `image_url`, `source_id`, `canonical_url` |
| `lib/supabase/queries/tools.ts` | `updateToolAnalyzedAt()` — exists, sets `analyzed_at` timestamp |
| `lib/supabase/queries/logs.ts` | `logInfo()`, `logWarn()`, `logError()` — all exist |
| `lib/scrape/pipeline.ts` | Console logging style with emoji prefixes (`📡`, `📄`, `🔗`, `✅`, `❌`, `⚠️`, `📊`) — the analysis pipeline must match this style |
| `lib/scrape/middleware.ts` | `verifyAdminSecret()` — uses `crypto.timingSafeEqual` for timing-safe comparison; returns `{ valid: boolean; error?: string }` |
| `lib/scrape/types.ts` | `PipelineSummary` pattern — the analysis pipeline should have a similar `AnalysisSummary` type |
| `app/api/scrape/route.ts` | API route pattern: Zod validation, admin secret check via `verifyAdminSecret()`, error handling, response format |
| `.env.example` | Has `OPENAI_API_KEY` and `ANALYSIS_BATCH_SIZE` already defined |
| `package.json` | No `ai`, `@ai-sdk/openai`, or `zod` dependencies yet — all need to be installed |

---

## Decisions & Assumptions

1. **NVIDIA API as OpenAI-compatible backend**: The `@ai-sdk/openai` provider supports `baseURL` configuration. We pass `https://integrate.api.nvidia.com/v1` as the base URL and use `nvapi-...` key stored in `OPENAI_API_KEY`.
2. **Model**: `minimaxai/minimax-m3` — selected for fast, structured analysis output.
3. **`generateObject` over `generateText`**: We use the Vercel AI SDK's `generateObject` API with Zod schema mode for reliable structured output parsing. No intermediate JSON.parse step needed.
4. **Pending detection via LEFT JOIN**: We detect tools needing analysis by LEFT JOINing `tools` to `tool_analyses` and checking `tool_analyses.id IS NULL`. This avoids the race condition of relying solely on `analyzed_at IS NULL`.
5. **Sequential processing**: Tools are analyzed one at a time (sequential loop) to avoid rate limiting the NVIDIA API. A 500ms sleep is inserted between tools.
6. **One retry on validation failure**: If the AI output fails Zod validation, we retry once. If it fails again, we mark the tool as failed and continue.
7. **`OPENAI_BASE_URL` env var**: Added to `.env.example` for clarity — used by `@ai-sdk/openai` provider configuration.

---

## Files Likely to Change (6 new files + 2 modified)

### New files
1. `lib/analyze/schema.ts` — Zod schema + type + helper
2. `lib/analyze/prompt.ts` — System prompt + prompt builder
3. `lib/analyze/analyze-tool.ts` — Single tool analysis function
4. `lib/analyze/index.ts` — Batch orchestrator (the pipeline entry point)
5. `lib/analyze/index.ts` is the only file needed — do NOT create a separate barrel export file

### Modified files
6. `app/api/analyze/route.ts` — API route handler (NEW file under `app/api/analyze/`)
7. `lib/supabase/queries/tools.ts` — Update `getPendingAnalysisTools` to return full tool data
8. `.env.example` — Add `OPENAI_BASE_URL`

---

## Implementation Requirements

### Step 0: Install packages

```bash
npm install ai @ai-sdk/openai zod
```

- `ai` — Vercel AI SDK core (provides `generateObject`)
- `@ai-sdk/openai` — OpenAI provider (supports custom `baseURL` for NVIDIA API)
- `zod` — Runtime validation (may already be installed transitively, but explicit install is fine)

### Step 1: Create `lib/analyze/schema.ts`

Zod schema that defines the expected AI analysis output structure.

```typescript
// lib/analyze/schema.ts
// Zod schema for validating AI analysis output from the NVIDIA API.
// Defines the exact shape expected from generateObject output validation.

import { z } from 'zod';

export const AnalysisSchema = z.object({
  summary: z.string(),
  adoptionScore: z.number().min(-1).max(1),
  adoptionLabel: z.enum(['early-stage', 'growing', 'established']),
  toolRatingLabel: z.enum(['beginner-friendly', 'balanced', 'power-user', 'mixed', 'unclear']),
  beginnerFriendlyPercentage: z.number().int().min(0).max(100),
  balancedPercentage: z.number().int().min(0).max(100),
  powerUserPercentage: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
  mainPurpose: z.string(),
  category: z.string(),
  targetUsers: z.string(),
  keyFeatures: z.array(z.string()),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  pricingModel: z.enum(['free', 'freemium', 'paid', 'usage-based', 'enterprise', 'unclear']),
  integrations: z.array(z.string()),
  bestFor: z.string(),
  marketingBuzzwords: z.array(z.string()),
  ratingNotes: z.string(),
  disclaimer: z.string(),
}).refine(
  (data) => data.beginnerFriendlyPercentage + data.balancedPercentage + data.powerUserPercentage === 100,
  {
    message: 'beginnerFriendlyPercentage + balancedPercentage + powerUserPercentage must equal 100',
    path: ['beginnerFriendlyPercentage'],
  }
);

export type AnalysisOutput = z.infer<typeof AnalysisSchema>;

/**
 * Compute the complexity score from an analysis output.
 * Formula: (powerUserPercentage - beginnerFriendlyPercentage) / 100
 * Result range: -1 to 1
 */
export function computeComplexityScore(output: AnalysisOutput): number {
  return (output.powerUserPercentage - output.beginnerFriendlyPercentage) / 100;
}
```

Key points:
- `.refine()` validates the sum constraint — the three percentages MUST add to exactly 100.
- `int()` ensures whole numbers for percentages.
- `z.enum()` ensures only valid label values.
- Export both the schema (for `generateObject`) and the inferred type (for use in the pipeline).

### Step 2: Create `lib/analyze/prompt.ts`

System prompt and prompt builder for the AI analysis model.

```typescript
// lib/analyze/prompt.ts
// System prompt and prompt builder for the AI tool analysis model.

/**
 * System prompt instructing the AI to act as a developer tool analyst.
 *
 * Rules:
 * - Analyze ONLY based on the provided scraped text — no external knowledge.
 * - Output valid JSON matching the schema.
 * - Mark `unclear` and low confidence when evidence is insufficient.
 * - Ensure percentages sum to 100.
 * - Assign rating label matching strongest percentage.
 * - Use only factual evidence from the text, not brand reputation.
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are a senior developer tool analyst at DevScout AI, a platform that helps developers discover and compare tools.

Your job is to analyze a developer tool based ONLY on the scraped web page text provided below. Do NOT use any external knowledge, brand reputation, or information beyond what is in the provided text.

Analyze the tool and return a JSON object with the following fields:

- summary: A neutral, factual 2-3 sentence summary of what the tool does.
- adoptionScore: A number from -1 to 1 indicating the tool's adoption stage (-1 = brand new / no traction, 0 = growing, 1 = widely adopted).
- adoptionLabel: One of "early-stage", "growing", or "established".
- toolRatingLabel: One of "beginner-friendly", "balanced", "power-user", "mixed", or "unclear". This should reflect the intended audience based on the tool's complexity and target users described in the text. Match it to the strongest percentage.
- beginnerFriendlyPercentage: Integer 0-100 — percentage of features/design that seem beginner-friendly.
- balancedPercentage: Integer 0-100 — percentage that seems balanced (mid-level).
- powerUserPercentage: Integer 0-100 — percentage that seems for power users/experts.
- **IMPORTANT**: beginnerFriendlyPercentage + balancedPercentage + powerUserPercentage MUST equal exactly 100.
- confidence: A number from 0 to 1 indicating how confident you are in this analysis based on the available text.
- mainPurpose: The primary purpose of the tool in one sentence.
- category: The primary category (e.g., "API Development", "Database", "Frontend Framework", "DevOps", "Testing", "AI/ML", "Monitoring", "Security", "Productivity", "Design", "Communication", "Analytics").
- targetUsers: A comma-separated description of the target audience.
- keyFeatures: Array of key feature strings (3-8 items).
- pros: Array of advantage strings (2-5 items).
- cons: Array of disadvantage or limitation strings (2-5 items).
- pricingModel: One of "free", "freemium", "paid", "usage-based", "enterprise", or "unclear".
- integrations: Array of integration/platform strings the tool works with.
- bestFor: A phrase describing what the tool is best used for.
- marketingBuzzwords: Array of marketing terms or buzzwords found in the text.
- ratingNotes: A paragraph explaining the reasoning behind the rating, including what evidence was available and what was missing.
- disclaimer: A standard disclaimer that this rating is AI-estimated based on the available scraped content and may not reflect the current state of the tool.

If the text lacks sufficient evidence for a particular field, mark it conservatively:
- Use "unclear" for labels when uncertain.
- Keep confidence below 0.5 when evidence is weak.
- For rating labels, match the strongest percentage category.
- Do NOT fabricate information. It is better to mark something as unclear than to guess.

Return ONLY valid JSON matching the schema above. No markdown, no explanation, no backticks.`;

/**
 * Build the user prompt for a specific tool.
 */
export function buildAnalysisPrompt(toolName: string, rawText: string): string {
  return `Analyze the following developer tool based on its scraped web page text.

Tool Name: ${toolName}

Scraped Page Text:
---
${rawText}
---

Return a JSON object with the analysis fields as specified in the system prompt.`;
}
```

Key points:
- `ANALYSIS_SYSTEM_PROMPT` is a `const` string — export it for use in `analyze-tool.ts`.
- `buildAnalysisPrompt` takes `toolName` and `rawText` and returns a formatted user prompt string.
- The system prompt explicitly tells the AI to output ONLY valid JSON, no markdown or backticks.
- All field documentation matches the types in `lib/supabase/types.ts`.

### Step 3: Create `lib/analyze/analyze-tool.ts`

The single-tool analysis function that calls the NVIDIA API via Vercel AI SDK.

```typescript
// lib/analyze/analyze-tool.ts
// Single tool analysis function.
// Calls the NVIDIA API (OpenAI-compatible) via Vercel AI SDK's generateObject.

import 'server-only';

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { AnalysisSchema, type AnalysisOutput } from './schema';
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from './prompt';

// Create NVIDIA-configured OpenAI provider
const nvidiaProvider = createOpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = 'minimaxai/minimax-m3';

export interface AnalyzeToolResult {
  success: boolean;
  analysis?: AnalysisOutput;
  error?: string;
  toolId: string;
}

/**
 * Analyze a single tool by calling the NVIDIA API.
 * Retries once on validation failure.
 *
 * @param toolId - The tool's UUID
 * @param toolName - The tool's display name (for logging)
 * @param rawText - The scraped raw text of the tool page
 * @returns AnalyzeToolResult with success/failure status
 */
export async function analyzeTool(
  toolId: string,
  toolName: string,
  rawText: string
): Promise<AnalyzeToolResult> {
  if (!rawText || rawText.trim().length === 0) {
    return {
      success: false,
      error: 'No raw text available for analysis',
      toolId,
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      success: false,
      error: 'OPENAI_API_KEY environment variable is not set',
      toolId,
    };
  }

  let lastError: string | undefined;

  // Retry loop: try twice
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { object } = await generateObject({
        model: nvidiaProvider.chatModel(MODEL),
        schema: AnalysisSchema,
        system: ANALYSIS_SYSTEM_PROMPT,
        prompt: buildAnalysisPrompt(toolName, rawText),
        temperature: 0.3,
        maxTokens: 4096,
      });

      // Validation is automatic via schema mode — if we get here, it's valid
      return {
        success: true,
        analysis: object as AnalysisOutput,
        toolId,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error during AI analysis';

      if (attempt === 1) {
        console.warn(`  ⚠️  [Analysis] Attempt 1 failed for "${toolName}": ${lastError}. Retrying...`);
      } else {
        console.error(`  ❌ [Analysis] Attempt 2 failed for "${toolName}": ${lastError}`);
      }
    }
  }

  return {
    success: false,
    error: lastError || 'Analysis failed after 2 attempts',
    toolId,
  };
}
```

Key points:
- `'server-only'` — ensures this code never reaches the browser bundle.
- `createOpenAI` with custom `baseURL` and `apiKey` from env.
- `generateObject` with `schema: AnalysisSchema` — Zod validation is automatic.
- Temperature 0.3 for consistent structured output.
- maxTokens 4096 to ensure complete analysis output.
- Retry once on any error (network failure, validation failure, API error).
- Returns `{ success, analysis/error, toolId }` for the orchestrator to handle.

### Step 4: Create `lib/analyze/index.ts`

The batch orchestrator that coordinates analysis of multiple tools.

```typescript
// lib/analyze/index.ts
// Batch orchestrator for the AI analysis pipeline.
// Detects pending tools, analyzes them in batches, saves results.

import 'server-only';

import { analyzeTool } from './analyze-tool';
import { createServerReadOnlyClient } from '@/lib/supabase/client';
import type { InsertAnalysisParams } from '@/lib/supabase/types';
import type { Tool } from '@/lib/supabase/types';
import { getPendingAnalysisTools } from '@/lib/supabase/queries/tools';
import { upsertAnalysis } from '@/lib/supabase/queries/analyses';
import { updateToolAnalyzedAt } from '@/lib/supabase/queries/tools';
import { computeComplexityScore } from './schema';
import { logInfo } from '@/lib/supabase/queries/logs';

export interface AnalysisSummary {
  status: 'completed' | 'partial' | 'failed';
  checked: number;
  analyzed: number;
  skipped: number;
  failed: number;
  totalDuration: number;
  details: Array<{
    toolId: string;
    toolName: string;
    status: 'analyzed' | 'skipped' | 'failed';
    error?: string;
  }>;
}

/**
 * Sleep helper to avoid rate limiting.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get the batch size from env or default to 5.
 */
function getBatchSize(): number {
  const envVal = process.env.ANALYSIS_BATCH_SIZE;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 5;
}

/**
 * Helper: fetch full tool record for each pending tool id,
 * since getPendingAnalysisTools currently only returns `id`.
 *
 * This avoids changing the existing query signature while still
 * getting the data we need.
 */
async function fetchPendingToolsWithDetail(limit: number, toolIds?: string[]): Promise<Tool[]> {
  const supabase = await createServerReadOnlyClient();

  // Use the existing LEFT JOIN query but now select full fields
  // We updated getPendingAnalysisTools to return full data (see Step 6)
  const allPending = await getPendingAnalysisTools(limit);

  // If toolIds specified, filter to those ids
  if (toolIds && toolIds.length > 0) {
    const idSet = new Set(toolIds);
    const pendingWithIds = allPending.filter(t => idSet.has(t.id));
    console.log(`  🔍 [Analysis] Filtered to ${pendingWithIds.length} of ${allPending.length} pending tools by requested toolIds`);
    return pendingWithIds;
  }

  return allPending;
}

/**
 * Run the analysis pipeline on pending tools.
 *
 * @param options - Optional limit or specific tool IDs to analyze
 * @returns AnalysisSummary with status and counts
 */
export async function runAnalysisPipeline(options: {
  limit?: number;
  toolIds?: string[];
} = {}): Promise<AnalysisSummary> {
  const startTime = performance.now();
  const batchSize = getBatchSize();

  console.log('🤖 [Analysis] Starting analysis pipeline...');

  // 1. Get pending tools (uses LEFT JOIN pattern)
  const pendingLimit = options.limit || 50;
  const pendingTools = await fetchPendingToolsWithDetail(pendingLimit, options.toolIds);

  if (pendingTools.length === 0) {
    const duration = Math.round(performance.now() - startTime);
    console.log('  ℹ️  [Analysis] No pending tools to analyze');
    return {
      status: 'completed',
      checked: 0,
      analyzed: 0,
      skipped: 0,
      failed: 0,
      totalDuration: duration,
      details: [],
    };
  }

  console.log(`  📊 [Analysis] Found ${pendingTools.length} pending tools to analyze`);

  const total = pendingTools.length;
  const numBatches = Math.ceil(total / batchSize);
  let analyzed = 0;
  let skipped = 0;
  let failed = 0;
  const details: AnalysisSummary['details'] = [];

  // 2. Process in batches
  for (let batchNum = 0; batchNum < numBatches; batchNum++) {
    const startIdx = batchNum * batchSize;
    const endIdx = Math.min(startIdx + batchSize, total);
    const batch = pendingTools.slice(startIdx, endIdx);

    console.log(`  📊 Processing batch ${batchNum + 1}/${numBatches}: tools ${startIdx + 1}-${endIdx} of ${total}`);

    // Process tools sequentially to avoid rate limiting
    for (const tool of batch) {
      if (!tool.raw_text || tool.raw_text.trim().length === 0) {
        skipped++;
        details.push({
          toolId: tool.id,
          toolName: tool.name,
          status: 'skipped',
          error: 'No raw text available',
        });
        console.log(`  ⏭️  [Analysis] Skipped: ${tool.name} — no raw text`);
        continue;
      }

      console.log(`  🔍 [Analysis] Analyzing: ${tool.name}...`);

      const result = await analyzeTool(tool.id, tool.name, tool.raw_text);

      if (result.success && result.analysis) {
        try {
          // Prepare analysis params
          const analysisParams: InsertAnalysisParams = {
            tool_id: tool.id,
            summary: result.analysis.summary,
            subtitle: '',
            adoption_score: result.analysis.adoptionScore,
            adoption_label: result.analysis.adoptionLabel,
            tool_rating_label: result.analysis.toolRatingLabel,
            beginner_friendly_percentage: result.analysis.beginnerFriendlyPercentage,
            balanced_percentage: result.analysis.balancedPercentage,
            power_user_percentage: result.analysis.powerUserPercentage,
            complexity_score: computeComplexityScore(result.analysis),
            confidence: result.analysis.confidence,
            main_purpose: result.analysis.mainPurpose,
            category: result.analysis.category,
            target_users: result.analysis.targetUsers,
            key_features: result.analysis.keyFeatures,
            pros: result.analysis.pros,
            cons: result.analysis.cons,
            pricing_model: result.analysis.pricingModel,
            integrations: result.analysis.integrations,
            best_for: result.analysis.bestFor,
            marketing_buzzwords: result.analysis.marketingBuzzwords,
            rating_notes: result.analysis.ratingNotes,
            disclaimer: result.analysis.disclaimer,
            model: MODEL,
          };

          // Save analysis to DB
          await upsertAnalysis(analysisParams);

          // Update analyzed_at timestamp
          await updateToolAnalyzedAt({
            id: tool.id,
            analyzed_at: new Date().toISOString(),
          });

          analyzed++;
          details.push({
            toolId: tool.id,
            toolName: tool.name,
            status: 'analyzed',
          });

          console.log(`  ✅ [Analysis] Analyzed: ${tool.name} (adoption: ${result.analysis.adoptionLabel}, rating: ${result.analysis.toolRatingLabel})`);
        } catch (dbError) {
          failed++;
          const errorMsg = dbError instanceof Error ? dbError.message : 'DB save error';
          details.push({
            toolId: tool.id,
            toolName: tool.name,
            status: 'failed',
            error: errorMsg,
          });
          console.error(`  ❌ [Analysis] Failed to save analysis for ${tool.name}: ${errorMsg}`);
        }
      } else {
        failed++;
        details.push({
          toolId: tool.id,
          toolName: tool.name,
          status: 'failed',
          error: result.error || 'Unknown error',
        });
        console.error(`  ❌ [Analysis] Failed: ${tool.name} — ${result.error}`);
      }

      // Sleep between tools to avoid rate limiting
      await sleep(500);
    }
  }

  const endTime = performance.now();
  const totalDuration = Math.round(endTime - startTime);

  // Determine status
  let status: AnalysisSummary['status'] = 'completed';
  if (failed === total) {
    status = 'failed';
  } else if (failed > 0 || skipped > 0) {
    status = 'partial';
  }

  const summary: AnalysisSummary = {
    status,
    checked: total,
    analyzed,
    skipped,
    failed,
    totalDuration,
    details,
  };

  console.log(`\n📊 [Analysis] Pipeline complete: ${analyzed} analyzed, ${failed} failed, ${skipped} skipped (${totalDuration}ms)`);
  console.log(`📊 [Analysis] Summary: ${JSON.stringify(summary, null, 2)}`);

  // Log to Supabase
  try {
    await logInfo('Analysis pipeline completed', {
      summary: {
        status,
        checked: total,
        analyzed,
        skipped,
        failed,
        totalDuration,
      },
    });
  } catch {
    // non-critical — don't fail the pipeline if logging fails
  }

  return summary;
}
```

Key points:
- Uses `getPendingAnalysisTools` (which will be updated to return full tool data in Step 6).
- Sequential processing with 500ms sleep between tools to prevent rate limiting.
- Configurable batch size from `ANALYSIS_BATCH_SIZE` env var (default 5).
- Uses `upsertAnalysis` to save (handles both insert and update).
- Uses `updateToolAnalyzedAt` to set the timestamp.
- `computeComplexityScore` derives the complexity score from the AI output.
- Logging style matches the scraping pipeline (`🤖`, `📊`, `🔍`, `✅`, `❌`, `⏭️`).
- Returns `AnalysisSummary` — mirrors `PipelineSummary` from the scraping pipeline.
- Graceful error handling: individual tool failures do not stop the batch.

### Step 5: Create `app/api/analyze/route.ts`

The POST API route that triggers the analysis pipeline.

```typescript
// app/api/analyze/route.ts
// POST /api/analyze — Manual AI analysis trigger.
// Requires x-devscout-admin-secret header (admin secret).
// Optionally accepts { limit?: number, toolIds?: string[] }.
// Returns an AnalysisSummary with counts and status.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminSecret } from '@/lib/scrape/middleware';
import { runAnalysisPipeline } from '@/lib/analyze';

const RequestSchema = z.object({
  limit: z.number().int().positive().optional(),
  toolIds: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  // 1. Verify admin secret
  const auth = verifyAdminSecret(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  // 2. Parse and validate request body (optional — empty body is fine)
  let limit: number | undefined;
  let toolIds: string[] | undefined;

  try {
    const text = await request.text();
    if (text && text.trim().length > 0) {
      const body = JSON.parse(text);
      const parsed = RequestSchema.parse(body);
      limit = parsed.limit;
      toolIds = parsed.toolIds;
    }
    // Empty body: process all pending with default limit
  } catch {
    // If body parsing fails, ignore and process all pending
    // This matches the scrape route pattern where empty body defaults
  }

  // 3. Run analysis pipeline
  try {
    const summary = await runAnalysisPipeline({ limit, toolIds });
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    console.error('[Analysis] Pipeline error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

Key points:
- `verifyAdminSecret` returns `{ valid, error }` — same pattern as scrape route.
- Request body is optional. If empty, all pending tools are analyzed.
- Optional `limit` and `toolIds` for targeted analysis.
- Returns `{ success, summary }` matching the scrape route response pattern.

### Step 6: Update `lib/supabase/queries/tools.ts`

Update the `getPendingAnalysisTools` function to return full tool data including `raw_text`.

**Current implementation** (lines 102-125):
```typescript
export async function getPendingAnalysisTools(limit = 50): Promise<Tool[]> {
  const supabase = await createServerReadOnlyClient();

  const { data, error } = await supabase
    .from('tools')
    .select(`
      id,
      tool_analyses (id)
    `)
    .is('tool_analyses.id', null)
    .order('scraped_at', { ascending: true })
    .limit(limit)
    .overrideTypes<{ id: string; tool_analyses: { id: string } | null }[], { merge: false }>();

  if (error) {
    console.error('Error fetching pending analysis tools:', error);
    throw new Error(`Failed to fetch pending analysis tools: ${error.message}`);
  }

  return (data as { id: string; tool_analyses: { id: string } | null }[])?.map(({ tool_analyses: _tool_analyses, ...tool }) => tool as Tool) || [];
}
```

**Required change**: Change the `.select()` to return all tool fields instead of just `id`. Keep the LEFT JOIN pattern (`is('tool_analyses.id', null)`) for pending detection.

Updated function:
```typescript
export async function getPendingAnalysisTools(limit = 50): Promise<Tool[]> {
  const supabase = await createServerReadOnlyClient();

  // Use LEFT JOIN to find tools without analysis (per AGENTS.md Section 19)
  // Select all tool fields so the analysis pipeline has raw_text, name, etc.
  const { data, error } = await supabase
    .from('tools')
    .select(`
      *,
      tool_analyses (id)
    `)
    .is('tool_analyses.id', null)
    .order('scraped_at', { ascending: true })
    .limit(limit)
    .overrideTypes<(Tool & { tool_analyses: { id: string } | null })[], { merge: false }>();

  if (error) {
    console.error('Error fetching pending analysis tools:', error);
    throw new Error(`Failed to fetch pending analysis tools: ${error.message}`);
  }

  // Filter out the joined tool_analyses field since we only used it for the LEFT JOIN
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (data as (Tool & { tool_analyses: { id: string } | null })[])?.map(
    ({ tool_analyses: _tool_analyses, ...tool }) => tool as Tool
  ) || [];
}
```

**IMPORTANT**: Keep the LEFT JOIN pattern with `is('tool_analyses.id', null)`. Do NOT switch to `analyzed_at IS NULL`. The LEFT JOIN is the canonical pending detection method per AGENTS.md §19.

### Step 7: Update `.env.example`

Add `OPENAI_BASE_URL` to the environment variables section. It's already at line 26 — ensure the existing entry is present and add the new `OPENAI_BASE_URL` entry.

The existing `.env.example` already has:
```
# --- OpenAI (AI Analysis) ---
OPENAI_API_KEY=
```

Add after line 27:
```
# Custom base URL for OpenAI-compatible API (NVIDIA, etc.)
OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1
```

---

## Security Requirements

1. **Admin secret required**: `POST /api/analyze` must verify `x-devscout-admin-secret` header using `verifyAdminSecret()` from `lib/scrape/middleware.ts`. Return 401 on missing or invalid secret.
2. **API key is server-only**: `OPENAI_API_KEY` is read from `process.env.OPENAI_API_KEY`. Never expose it to browser code. All `lib/analyze/*.ts` files include `'server-only'`.
3. **`OPENAI_BASE_URL` is server-only**: No `NEXT_PUBLIC_` prefix. The base URL is configured inside the server-side `createOpenAI()` call.
4. **Never expose NVIDIA key**: The `nvapi-...` key stays in `.env.local` and is never sent to the client bundle.

---

## Acceptance Criteria

- [ ] `POST /api/analyze` processes pending tools without analysis
- [ ] Uses LEFT JOIN for pending detection (not `analyzed_at IS NULL`) — the `getPendingAnalysisTools` query uses `.is('tool_analyses.id', null)`
- [ ] Validates AI output with Zod before saving to DB — `generateObject` uses `schema: AnalysisSchema`
- [ ] Uses Vercel AI SDK `generateObject` with `@ai-sdk/openai` provider via `createOpenAI`
- [ ] Custom `baseURL` points to `https://integrate.api.nvidia.com/v1`
- [ ] Uses `minimaxai/minimax-m3` model
- [ ] Retries once on validation/AI failure — try/catch loop with attempt 1 and 2
- [ ] Batching with configurable batch size (`ANALYSIS_BATCH_SIZE` env var or default 5)
- [ ] Admin secret required — 401 on missing/invalid `x-devscout-admin-secret`
- [ ] Returns `AnalysisSummary` with `analyzed`, `skipped`, `failed` counts
- [ ] Console logs match scraping pipeline style (emoji prefixes: `🤖`, `📊`, `🔍`, `✅`, `❌`, `⏭️`)
- [ ] `getPendingAnalysisTools` returns full tool data including `raw_text`, `name`, `image_url`
- [ ] `analyzed_at` is set on the tool row after successful analysis is saved
- [ ] TypeScript, no `any`, small functions — all new code passes `typecheck` and `lint`

---

## Checks to Run

After implementation, run from the project root:

```bash
npm run typecheck
npm run lint
```

Both must pass with zero errors.

---

## Exact Manual Test Steps

1. Start the dev server:
```bash
npm run dev
```

2. In a separate terminal, send a POST request to trigger analysis of 5 pending tools:
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -H "x-devscout-admin-secret: <your-admin-secret>" \
  -d '{"limit": 5}'
```

3. Watch the dev server terminal for analysis progress logs:
- `🤖 [Analysis] Starting analysis pipeline...`
- `📊 [Analysis] Found N pending tools to analyze`
- `📊 Processing batch 1/N: tools 1-5 of N`
- `🔍 [Analysis] Analyzing: ToolName...`
- `✅ [Analysis] Analyzed: ToolName (adoption: early-stage, rating: beginner-friendly)`
- Final summary: `📊 [Analysis] Pipeline complete: N analyzed, 0 failed, 0 skipped (XXms)`

4. Verify the response:
```json
{
  "success": true,
  "summary": {
    "status": "completed",
    "checked": 5,
    "analyzed": 5,
    "skipped": 0,
    "failed": 0,
    "totalDuration": 35000,
    "details": [...]
  }
}
```

5. Test with missing admin secret (should return 401):
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"limit": 1}'
```

6. Test with no request body (should process all pending):
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -H "x-devscout-admin-secret: <your-admin-secret>"
```

---

## Implementation Order

Implement in this exact order to avoid confusion:

1. Install packages (`ai`, `@ai-sdk/openai`, `zod`)
2. Create `lib/analyze/schema.ts`
3. Create `lib/analyze/prompt.ts`
4. Create `lib/analyze/analyze-tool.ts`
5. Create `lib/analyze/index.ts`
6. Update `lib/supabase/queries/tools.ts` — `getPendingAnalysisTools`
7. Create `app/api/analyze/route.ts`
8. Update `.env.example` — add `OPENAI_BASE_URL`
9. Run `typecheck` and `lint`
10. Test manually with curl

---

## Rollback Plan

If the analysis pipeline causes issues:
1. Remove `app/api/analyze/` route directory
2. Remove `lib/analyze/` directory
3. Revert `lib/supabase/queries/tools.ts` changes to `getPendingAnalysisTools`
4. Revert `.env.example` additions

Files are additive — no existing functionality is modified (except `getPendingAnalysisTools` and `.env.example`), so rollback is straightforward.
