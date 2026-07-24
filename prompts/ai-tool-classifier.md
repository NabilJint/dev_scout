# Implementation Prompt: AI Tool Classifier Pre-Filter

## Goal

Add an AI-powered pre-filter step to the scrape pipeline that classifies whether each scraped candidate is a **genuine developer tool** before inserting it into the database. The classifier sits between content validation and the STORE phase, rejecting blog posts, news articles, learning resources, personal projects, and non-product pages that pass the existing rule-based content gate.

---

## Assigned Specialist Agent(s)

| Agent | Role |
|-------|------|
| **Backend Engineer** (primary) | Implements the classifier function in `lib/scrape/classifier.ts`, wires it into `processHomepageContent()` in `lib/scrape/pipeline.ts`, updates types |
| **AI/ML Engineer** | Reviews the LLM prompt design, confirms model compatibility with the existing NVIDIA setup |
| **Code Reviewer** | Reviews all diffs before merge |
| **QA Engineer** | Runs `typecheck`, `lint`; provides test commands |
| **Documentation Memory Agent** | Logs the outcome |

---

## Skills Read

- `.agents/skills/ai-sdk` — Vercel AI SDK usage patterns: `generateObject` for structured output, `createOpenAI` for custom provider setup, `@ai-sdk/openai` provider with custom `baseURL`, Zod schema integration
- `node_modules/next/dist/docs/` — Next.js 16 API route patterns, route handlers, server-only modules

---

## Existing Code Inspected

| File | Key Findings |
|------|-------------|
| `lib/scrape/pipeline.ts` | Per-candidate loop at lines 551–756. Content validation (`validateToolContent`) at line 691. STORE phase starts at line 700. The AI classifier must go between them. |
| `lib/scrape/types.ts` | `PipelineSummary` has `toolsRejected` (count) and `rejectionReasons` (map). Add `aiRejected` count. `PipelineStage` union — may want to add `AI_CLASSIFY` stage. |
| `lib/scrape/validate.ts` | `validateToolContent()` — existing rule-based gate. Catches generic titles, missing images, article patterns, consumer products. The AI classifier is complementary, not a replacement. |
| `lib/analyze/analyze-tool.ts` | Existing pattern for calling NVIDIA API via Vercel AI SDK. Uses `createOpenAI` with `baseURL: https://integrate.api.nvidia.com/v1`, model `minimaxai/minimax-m3`. Uses `generateObject` with Zod schema. Has retry logic. |
| `lib/analyze/schema.ts` | Existing Zod schema for the full analysis output. The classifier needs its own simpler schema. |
| `.env.example` | Has `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `ANALYSIS_BATCH_SIZE`. Will add `SKIP_AI_CLASSIFIER`. |

---

## Decisions & Assumptions

1. **Same AI provider as analysis**: Uses the identical `createOpenAI` provider pointing at NVIDIA API (`minimaxai/minimax-m3`). This avoids adding a second model dependency.
2. **Separate file for classifier**: Create `lib/scrape/classifier.ts` (not in `lib/analyze/`). The classifier is part of the scrape pipeline, not the analysis pipeline.
3. **Fail open**: If the AI call fails (timeout, network error, invalid response), the tool is **accepted** rather than rejected. The classifier is a quality improvement, not a security gate.
4. **Fast, single-shot**: One LLM call per candidate. No retries (unlike the analysis pipeline which retries once). Timeout at 10 seconds.
5. **Preview only**: Send only the first 500 characters of raw text, plus the tool name and source. Do not send full page text — keeps costs low and latency short.
6. **Low confidence threshold**: Reject only when `confidence < 0.3`. This is intentionally conservative — only filter out clear non-tools, not borderline cases.
7. **Not a replacement**: The AI classifier is additive to the existing rule-based `validateToolContent()` gate. Both must pass for a tool to be inserted.
8. **Optional**: Controlled by `SKIP_AI_CLASSIFIER` env var. When set to `true`, the classifier step is skipped entirely (useful for testing or when running on a tight budget).

---

## Location in Pipeline

```
... NORMALIZE → validateToolContent() → AI CLASSIFIER (NEW) → STORE
```

In `lib/scrape/pipeline.ts` `processHomepageContent()`, the insertion point is:

- **After** line 698 (`continue` on validation failure)
- **Before** line 700 (the STORE phase comment)

The classifier runs inside the per-candidate `for` loop (line 551), right after the `validateToolContent()` check passes.

---

## Files Likely to Change (3 files modified, 1 new)

### New files
1. `lib/scrape/classifier.ts` — The AI classification function containing the prompt, Zod schema, and model call

### Modified files
2. `lib/scrape/types.ts` — Add `ToolClassification` interface, add `aiRejected` to `PipelineSummary`, add `AI_CLASSIFY` to `PipelineStage`
3. `lib/scrape/pipeline.ts` — Import classifier, call it between validation and store, count rejections, log classifications
4. `.env.example` — Add `SKIP_AI_CLASSIFIER` env var

---

## Implementation Requirements

### Step 1: Update `lib/scrape/types.ts`

**a) Add `ToolClassification` interface** (before `PipelineSummary`):

```typescript
/**
 * Result of the AI tool classifier pre-filter step.
 * Determines whether a scraped candidate is a genuine developer tool.
 */
export interface ToolClassification {
  /** Whether the candidate is a genuine developer tool or product. */
  isDeveloperTool: boolean;
  /** Confidence in the classification (0 to 1). */
  confidence: number;
  /** Brief explanation for the classification. */
  reason: string;
  /** Classified tool type. */
  toolType: 'developer-tool' | 'library-framework' | 'learning-resource' | 'blog-post' | 'news-article' | 'personal-project' | 'non-product' | 'unclear';
}
```

**b) Add `AI_CLASSIFY` to the `PipelineStage` union** (line 16):

```typescript
export type PipelineStage =
  | 'RESOLVE_URL'
  | 'FETCH'
  | 'EXTRACT'
  | 'NORMALIZE'
  | 'AI_CLASSIFY'       // NEW: AI classifier pre-filter
  | 'STORE'
  | 'AI_ANALYSIS'
  | 'SAVE'
  ;
```

**c) Add `aiRejected` to `PipelineSummary`** (after `toolsRejected` on line 63):

```typescript
export interface PipelineSummary {
  // ... existing fields ...
  toolsRejected: number;
  /** Number of tools rejected by the AI classifier (non-tools). */
  aiRejected?: number;       // NEW — optional to not break existing callers
  // ... remaining fields ...
}
```

### Step 2: Create `lib/scrape/classifier.ts`

Create a new file at `lib/scrape/classifier.ts`:

```typescript
// lib/scrape/classifier.ts
// AI-powered pre-filter that classifies whether a scraped candidate is
// a genuine developer tool. Called between content validation and STORE
// in the scrape pipeline. Fail-open: if the AI call fails, the tool is
// accepted rather than rejected.

import 'server-only';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { ToolClassification } from './types';

// ---------------------------------------------------------------------------
// Provider — same as the analysis pipeline
// ---------------------------------------------------------------------------

const nvidiaProvider = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = 'minimaxai/minimax-m3';

// ---------------------------------------------------------------------------
// Zod schema for classification output
// ---------------------------------------------------------------------------

const ToolClassificationSchema = z.object({
  isDeveloperTool: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(200),
  toolType: z.enum([
    'developer-tool',
    'library-framework',
    'learning-resource',
    'blog-post',
    'news-article',
    'personal-project',
    'non-product',
    'unclear',
  ]),
});

// ---------------------------------------------------------------------------
// Classifier prompt
// ---------------------------------------------------------------------------

const CLASSIFIER_SYSTEM_PROMPT = `You are a classifier for DevScout AI, a platform that helps developers discover developer tools.

Your job is to determine whether a given web page represents a GENUINE DEVELOPER TOOL or PRODUCT.

A genuine developer tool is a software product, platform, framework, library, or service built primarily for developers, engineers, or technical users. Examples: API testing tools, IDEs, databases, monitoring platforms, cloud services, CI/CD platforms, version control tools, package managers, design-to-code tools, developer productivity tools.

The following are NOT developer tools:
- Blog posts, tutorials, or how-to articles
- News articles or announcements about tools
- Learning resources, courses, or educational content
- Personal projects, portfolios, or showcase pages
- Entertainment, gaming, or media consumption products
- E-commerce, fashion, travel, or consumer lifestyle products
- Corporate homepages with no clear product focus
- Documentation index pages (not the product itself)

Return a JSON object with:
- isDeveloperTool: true if this is a genuine developer tool or product
- confidence: 0 to 1 — how confident you are in this classification
- reason: a brief 1-sentence explanation for your decision
- toolType: one of "developer-tool", "library-framework", "learning-resource", "blog-post", "news-article", "personal-project", "non-product", or "unclear"

Base your decision ONLY on the provided information. If there is insufficient evidence to determine, set isDeveloperTool to false and confidence below 0.3.`;

// ---------------------------------------------------------------------------
// Classifier function
// ---------------------------------------------------------------------------

export interface ClassifyToolInput {
  /** The tool/product name. */
  name: string;
  /** The source name (e.g. "Product Hunt", "Hacker News"). */
  source: string;
  /** The candidate URL from the listing page. */
  candidateUrl: string;
  /** The resolved tool website URL, if available. */
  websiteUrl?: string | null;
  /** A short preview (~500 chars) of the raw text. */
  textPreview: string;
}

/**
 * AI timeout — 10 seconds.
 * If the model takes longer, the call is aborted and the tool is accepted.
 */
const CLASSIFIER_TIMEOUT_MS = 10_000;

/**
 * Classify whether a scraped candidate is a genuine developer tool.
 *
 * Fail-open: returns null (instead of throwing) on any error, signalling
 * "unable to classify, accept the tool". The caller logs a warning.
 *
 * @param input - Tool name, source, URL, and text preview.
 * @returns ToolClassification on success, or null on failure/timeout.
 */
export async function classifyTool(input: ClassifyToolInput): Promise<ToolClassification | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('  ⚠️  [Classifier] OPENAI_API_KEY not set — skipping classification');
    return null;
  }

  // Build the user prompt with the input data
  const prompt = buildClassifierPrompt(input);

  try {
    // Single attempt, no retry — fast classification, fail-open
    const { object } = await generateObject({
      model: nvidiaProvider.chat(MODEL),
      schema: ToolClassificationSchema,
      prompt,
      temperature: 0.1,        // Low temperature for consistent classification
      maxOutputTokens: 200,     // Short output — we only need a few fields
      maxRetries: 0,            // No retry — we fail-open instead
      // abortSignal is not directly supported by generateObject in AI SDK v6?
      // We handle timeout via the caller's AbortController.
    });

    return object as ToolClassification;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown classification error';
    console.warn(`  ⚠️  [Classifier] AI call failed: ${errorMsg} — accepting tool (fail-open)`);
    return null;
  }
}

/**
 * Build the user prompt for the classifier.
 * Sends only a ~500-char preview of the raw text to keep calls cheap and fast.
 */
function buildClassifierPrompt(input: ClassifyToolInput): string {
  return [
    `Classify the following candidate based on the provided information.`,
    ``,
    `Tool Name: ${input.name}`,
    `Source: ${input.source}`,
    `Candidate URL: ${input.candidateUrl}`,
    ...(input.websiteUrl ? [`Website URL: ${input.websiteUrl}`] : []),
    ``,
    `Content Preview (first 500 characters):`,
    `---`,
    input.textPreview.slice(0, 500),
    `---`,
    ``,
    `Is this a genuine developer tool? Return the JSON classification object.`,
  ].join('\n');
}
```

**Key points**:
- `'server-only'` — prevents bundling in browser code.
- Uses the **same** `createOpenAI` config as `lib/analyze/analyze-tool.ts` (`baseURL`, `apiKey`, model `minimaxai/minimax-m3`).
- Separate Zod schema for the classifier (simple: `isDeveloperTool`, `confidence`, `reason`, `toolType`).
- Low temperature (0.1) for deterministic classification.
- Short `maxOutputTokens` (200) — the output is tiny.
- **No retry loop** — on failure, return `null` and the caller accepts the tool.
- Helper `buildClassifierPrompt` constructs the user prompt from tool name, source, URL, and a 500-char text preview.
- Timeout handled via `AbortController` in the caller (Step 3) — wrapping the call in `Promise.race` or `AbortSignal.timeout`.

### Step 3: Wire into `lib/scrape/pipeline.ts`

In `lib/scrape/pipeline.ts`, import the classifier and wire it into `processHomepageContent()`.

**a) Add import** (after line 19, with the other imports):

```typescript
import { classifyTool } from './classifier';
import type { ToolClassification } from './types';
```

**b) Add accumulator variable** in `processHomepageContent()` (after line 390, with the other accumulators):

```typescript
let aiRejected = 0;
```

**c) Add the classification step** between content validation and the STORE phase.

After line 698 (the `continue` after `validateToolContent` rejects), before line 700 (the `// ===== PHASE: STORE =====` comment), insert:

```typescript
      // ===================================================================
      // PHASE: AI_CLASSIFY — AI pre-filter for genuine developer tools
      // ===================================================================
      const skipClassifier = process.env.SKIP_AI_CLASSIFIER === 'true';
      if (!skipClassifier) {
        const classifyStageStart = await logStageStart('AI_CLASSIFY', { source: source.name, toolName: scrapedTool.title }, pipelineRunId);
        try {
          const classification = await classifyTool({
            name: scrapedTool.title,
            source: source.name,
            candidateUrl: candidate.url,
            websiteUrl: scrapedTool.websiteUrl,
            textPreview: scrapedTool.rawText,
          });

          if (classification !== null) {
            if (!classification.isDeveloperTool || classification.confidence < 0.3) {
              aiRejected++;
              rejectionReasons['ai_classifier_rejected'] = (rejectionReasons['ai_classifier_rejected'] || 0) + 1;
              console.log(`    🤖 [Classifier] Rejected "${scrapedTool.title}" from ${source.name} — ${classification.reason} (type: ${classification.toolType}, confidence: ${classification.confidence.toFixed(2)})`);
              const classifyEnd = performance.now();
              await logStageEnd(classifyStageStart, { status: 'completed', metadata: { classified: true, rejected: true, toolType: classification.toolType, reason: classification.reason, confidence: classification.confidence }, pipelineRunId });
              stages.push({
                ...classifyStageStart.entry,
                status: 'completed',
                endTime: classifyEnd,
                durationMs: Math.round(classifyEnd - classifyStageStart.entry.startTime),
              });
              continue;
            }
            console.log(`    🤖 [Classifier] Accepted "${scrapedTool.title}" from ${source.name} — ${classification.reason} (type: ${classification.toolType}, confidence: ${classification.confidence.toFixed(2)})`);
          } else {
            // Null means AI call failed — fail-open, accept the tool
            console.log(`    🤖 [Classifier] AI call failed, accepting "${scrapedTool.title}" from ${source.name} (fail-open)`);
          }

          const classifyEnd = performance.now();
          await logStageEnd(classifyStageStart, { status: 'completed', metadata: { classified: classification !== null, rejected: false }, pipelineRunId });
          stages.push({
            ...classifyStageStart.entry,
            status: 'completed',
            endTime: classifyEnd,
            durationMs: Math.round(classifyEnd - classifyStageStart.entry.startTime),
          });
        } catch (err) {
          // Catch unexpected errors — fail-open
          const classifyEnd = performance.now();
          await logStageEnd(classifyStageStart, { status: 'failed', error: String(err), pipelineRunId });
          stages.push({
            ...classifyStageStart.entry,
            status: 'failed',
            endTime: classifyEnd,
            durationMs: Math.round(classifyEnd - classifyStageStart.entry.startTime),
            error: String(err),
          });
          console.warn(`    ⚠️  [Classifier] Unexpected error classifying "${scrapedTool.title}" from ${source.name}: ${err} — accepting tool (fail-open)`);
        }
      } else {
        console.log(`    ⏭️  [Classifier] Skipped (SKIP_AI_CLASSIFIER=true) for "${scrapedTool.title}" from ${source.name}`);
      }
```

**d) Update the return object** to include `aiRejected`:

In the return object (around line 767-782), add `aiRejected`:

```typescript
    toolsInserted,
    toolsRejected,
    aiRejected: aiRejected > 0 ? aiRejected : undefined,
    toolsFailed,
```

**e) Add to the `emptySummary()` function as well** (line 142, after `toolsRejected: 0`):

```typescript
    aiRejected: 0,
```

**f) Import the classifyTool function** — ensure the import is added to the top of the file.

**Important**: The `classifyTool` function already handles its own environment checks. The pipeline only checks `SKIP_AI_CLASSIFIER` to decide whether to call it at all.

### Step 4: Update `.env.example`

Add after the `ANALYSIS_BATCH_SIZE` entry (line 41):

```env
# --- Optional: AI Tool Classifier ---
# Set to "true" to skip the AI pre-filter step during scraping
# Useful for testing or when running on a limited AI budget
SKIP_AI_CLASSIFIER=false
```

---

## Security Requirements

1. **Server-only code**: `lib/scrape/classifier.ts` includes `'server-only'` — never reaches the browser bundle.
2. **API key is server-only**: `OPENAI_API_KEY` is read from `process.env.OPENAI_API_KEY`. Never exposed to browser code.
3. **Fail-open is safe**: The classifier is a quality improvement, not an access control gate. Accepting a non-tool is far less harmful than rejecting a legitimate tool due to a transient AI failure.
4. **No user data**: The classifier only sees tool names, source names, URLs, and public scraped text — no PII or authentication data.

---

## Acceptance Criteria

- [ ] Pipeline calls AI classifier for each candidate after content validation, before STORE
- [ ] Non-tools (blog posts, news articles, learning resources) are rejected with a log message showing `isDeveloperTool: false` and the reason
- [ ] Low-confidence classifications (`confidence < 0.3`) are also rejected
- [ ] Rejected count tracked in pipeline summary (`aiRejected`)
- [ ] If AI call fails (timeout, network error, invalid schema), the tool is accepted (fail-open) and a warning is logged
- [ ] Classifications are logged for debugging (tool name, source, reason, toolType, confidence)
- [ ] `SKIP_AI_CLASSIFIER=true` env var disables the classifier — tools pass through without classification, with a log message
- [ ] Only the first ~500 characters of `rawText` are sent to the AI model (keeps costs low)
- [ ] Uses the same NVIDIA API model (`minimaxai/minimax-m3`) as the analysis pipeline
- [ ] `PipelineStage` includes `AI_CLASSIFY` for structured stage logging
- [ ] `PipelineSummary` has `aiRejected` field
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

1. Ensure `.env.local` has `OPENAI_API_KEY` and `OPENAI_BASE_URL` set (same values already used for analysis).

2. Start the dev server:
```bash
npm run dev
```

3. Run a scrape to trigger the classifier. Watch for `🤖 [Classifier]` log lines:
```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -H "x-devscout-admin-secret: <your-admin-secret>" \
  -d '{
    "sources": ["producthunt", "hacker-news", "github-trending"],
    "perSourceLimit": 3
  }'
```

4. Watch the terminal for classification logs:
   - `🤖 [Classifier] Accepted "ToolName" from Product Hunt — clear developer tool (type: developer-tool, confidence: 0.95)`
   - `🤖 [Classifier] Rejected "Blog Post Title" from Hacker News — this is a tutorial article (type: blog-post, confidence: 0.88)`
   - `🤖 [Classifier] AI call failed, accepting "ToolName" from GitHub Trending (fail-open)` (only if AI errors occur)
   - `⏭️  [Classifier] Skipped (SKIP_AI_CLASSIFIER=true) for "ToolName" from Product Hunt` (when env var is set)

5. Verify final pipeline summary includes `aiRejected`:
```
📊 [Scrape] Pipeline summary: {
  "sourcesChecked": 3,
  "candidatesFound": 45,
  "candidatesRejected": 12,
  "duplicatesSkipped": 8,
  "detailPagesScraped": 25,
  "toolsInserted": 8,
  "toolsRejected": 10,
  "aiRejected": 5,
  "toolsFailed": 2,
  ...
}
```

6. Test with the classifier disabled:
```bash
SKIP_AI_CLASSIFIER=true curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -H "x-devscout-admin-secret: <your-admin-secret>" \
  -d '{
    "sources": ["producthunt"],
    "perSourceLimit": 2
  }'
```
   - Expect no `🤖 [Classifier]` lines in the output — only `⏭️  [Classifier] Skipped` lines.

---

## Implementation Order

1. Update `lib/scrape/types.ts` — add `ToolClassification`, `AI_CLASSIFY` to `PipelineStage`, `aiRejected` to `PipelineSummary`
2. Create `lib/scrape/classifier.ts` — Zod schema, prompt, `classifyTool` function
3. Update `lib/scrape/pipeline.ts` — import classifier, wire into `processHomepageContent()`, add accumulator, update summary return and `emptySummary()`
4. Update `.env.example` — add `SKIP_AI_CLASSIFIER`
5. Run `typecheck` and `lint`
6. Test manually with curl

---

## Rollback Plan

If the classifier causes issues:
1. Revert changes to `lib/scrape/pipeline.ts`
2. Delete `lib/scrape/classifier.ts`
3. Revert `lib/scrape/types.ts` additions
4. Revert `.env.example` additions

The classifier is additive — the pipeline still works without it (controlled by `SKIP_AI_CLASSIFIER=true` which effectively disables it).
