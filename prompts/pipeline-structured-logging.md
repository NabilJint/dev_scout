# Prompt: Structured Pipeline Logging Stages

## Goal

Introduce typed, structured stage logging across the entire scraping and analysis pipeline. Each pipeline stage (`RESOLVE_URL`, `FETCH`, `EXTRACT`, `NORMALIZE`, `STORE`, `AI_ANALYSIS`, `SAVE`) emits a consistent start/end log with duration, so pipeline execution can be traced, measured, and debugged programmatically — not just via ad-hoc `console.log` calls.

## Assigned Specialist Agent(s)

- **Backend Engineer** (primary — pipeline orchestration, enrichment, analysis)
- **Code Reviewer** (review diff)
- **QA Engineer** (run checks)

## Skills Read

- `supabase` — for Supabase query patterns (logging queries)
- Existing `AGENTS.md` — Sections 7, 9, 14, 16, 19 for pipeline/shared rules

## Existing Code Inspected

- `lib/scrape/types.ts` — `PipelineSummary`, `Parser` interfaces
- `lib/scrape/pipeline.ts` — `runScrapePipeline`, `processHomepageContent`
- `lib/scrape/scheduler.ts` — `syncSchedules`, `processScheduledResults`
- `lib/scrape/validate.ts` — `cleanRawText`, `validateToolContent`
- `lib/enrichment/index.ts` — `enrichTool` orchestration
- `lib/analyze/index.ts` — `runAnalysisPipeline`, `AnalysisSummary`
- `lib/supabase/queries/logs.ts` — `logInfo`, `logWarn`, `logError`, `insertLog`
- `lib/supabase/types.ts` — `Log`, `InsertLogParams`

## Decisions or Assumptions

1. **Stage names are a closed enum**, not free-form strings. This enables filtering, aggregation, and dashboarding by stage later.
2. **Stage logging is additive** — existing `console.log` calls remain. Stage logs are emitted *in addition* to existing logging, not as a replacement.
3. **Stage start/end are the minimum.** If a stage fails, the end log records `durationMs` with the error included in metadata.
4. **All pipeline entry points** (manual scrape, scheduler processing, cron pipeline, analysis pipeline) emit stage logs.
5. **Duration is measured in milliseconds** using `performance.now()` to enable precise timing analysis.
6. **No new DB table.** Stage logs use the existing `logs` table with a `stage` field embedded in the `metadata` JSONB column.
7. **Stages are optional context** — if a module doesn't fit cleanly into a stage, it can log without one.

## Files Likely to Change

| File | Change |
|------|--------|
| `lib/scrape/types.ts` | Add `PipelineStage` type, `StageLogEntry` type, update `PipelineSummary` with optional `stages` |
| `lib/scrape/pipeline.ts` | Wrap stage boundaries with structured start/end logging |
| `lib/scrape/scheduler.ts` | Wrap schedule sync and process stages with structured logging |
| `lib/enrichment/index.ts` | Wrap enrichment stages with structured logging |
| `lib/analyze/index.ts` | Wrap analysis stages with structured logging |
| `lib/supabase/queries/logs.ts` | Add `logStageStart`, `logStageEnd` convenience functions |
| `lib/supabase/types.ts` | Add `InsertStageLogParams` (optional), update `InsertLogParams` if needed |

## Implementation Requirements

### Step 1: Define PipelineStage type in `lib/scrape/types.ts`

```typescript
/**
 * Canonical stage names for the scrape/analyze pipeline.
 * Each stage maps to a well-defined phase of processing.
 */
export type PipelineStage =
  | 'RESOLVE_URL'       // Resolving a tool's canonical website URL
  | 'FETCH'             // Fetching HTML (Oxylabs, direct HTTP, or Jina)
  | 'EXTRACT'           // Parsing HTML and extracting structured data
  | 'NORMALIZE'         // Cleaning, normalizing, deduplicating
  | 'STORE'             // Inserting or updating database records
  | 'AI_ANALYSIS'       // AI analysis call (tool rating, adoption, etc.)
  | 'SAVE'              // Saving analysis results to database
  ;

/**
 * Metadata for a single stage execution.
 */
export interface StageLogEntry {
  stage: PipelineStage;
  startTime: number;      // performance.now() at start
  endTime?: number;       // performance.now() at end
  durationMs?: number;    // endTime - startTime
  status: 'started' | 'completed' | 'failed';
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Optional: add stages array to PipelineSummary for aggregating per-pipeline-run stage data.
 */
export interface PipelineSummary {
  // ... existing fields ...
  stages?: StageLogEntry[];  // NEW — array of stage entries for this run
}
```

Make `stages` optional so existing consumers don't need updating.

### Step 2: Add logStageStart/logStageEnd in `lib/supabase/queries/logs.ts`

Add two convenience functions that use the existing `insertLog` function internally:

```typescript
import type { PipelineStage, StageLogEntry } from '@/lib/scrape/types';

/**
 * Log the start of a pipeline stage.
 * Inserts an 'info' log with stage name and start timestamp in metadata.
 */
export async function logStageStart(
  stage: PipelineStage,
  metadata?: Record<string, unknown>
): Promise<{ log: Log; entry: StageLogEntry }> {
  const startTime = performance.now();
  const log = await insertLog({
    level: 'info',
    message: `Stage started: ${stage}`,
    metadata: {
      ...metadata,
      stage,
      stageStatus: 'started',
      stageStartMs: startTime,
    } as unknown as Json,
  });
  return {
    log,
    entry: { stage, startTime, status: 'started', metadata },
  };
}

/**
 * Log the completion (or failure) of a pipeline stage.
 * Requires the StageLogEntry from the corresponding logStageStart call.
 * Computes durationMs automatically.
 */
export async function logStageEnd(
  startEntry: StageLogEntry,
  overrides?: {
    status?: 'completed' | 'failed';
    error?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<Log> {
  const endTime = performance.now();
  const durationMs = Math.round(endTime - startEntry.startTime);
  const status = overrides?.status ?? 'completed';

  return insertLog({
    level: status === 'failed' ? 'error' : 'info',
    message: `Stage ${status === 'failed' ? 'failed' : 'completed'}: ${startEntry.stage} (${durationMs}ms)`,
    metadata: {
      ...startEntry.metadata,
      ...overrides?.metadata,
      stage: startEntry.stage,
      stageStatus: status,
      stageDurationMs: durationMs,
      stageStartMs: startEntry.startTime,
      stageEndMs: endTime,
      ...(overrides?.error ? { error: overrides.error } : {}),
    } as unknown as Json,
  });
}
```

### Step 3: Integrate into `lib/scrape/pipeline.ts`

For the `processHomepageContent` function (shared between manual scraping and scheduler), wrap major sections with stage logging:

| Pipeline section | Stage |
|---|---|
| Extracting candidates from HTML | `EXTRACT` |
| Rejecting non-tool URLs, normalizing, deduping | `NORMALIZE` |
| Checking existing URLs in DB | `NORMALIZE` |
| Scraping each tool detail page | `FETCH` (per tool) |
| Extracting tool content from detail page | `EXTRACT` (per tool) |
| Inserting tool into DB | `STORE` (per tool) |

For `runScrapePipeline`, wrap the homepage fetch section with `FETCH` stages.

Structure each stage as:

```typescript
const stageStart = await logStageStart('EXTRACT', { source: source.name });
try {
  // ... stage logic ...
  await logStageEnd(stageStart, { status: 'completed', metadata: { candidatesFound: candidates.length } });
} catch (err) {
  await logStageEnd(stageStart, { status: 'failed', error: String(err) });
  throw err; // re-throw if the error is fatal
}
```

**Do not remove** existing `console.log` calls. Stage logs are additional.

### Step 4: Integrate into `lib/scrape/scheduler.ts`

Wrap `syncSchedules` and `processScheduledResults` with stage logging:

| Section | Stage |
|---|---|
| Syncing schedules | `NORMALIZE` |
| Processing each schedule's Oxylabs runs | `FETCH` |
| Running the pipeline on fetched HTML | → delegates to `processHomepageContent` (already logged) |

### Step 5: Integrate into `lib/enrichment/index.ts`

Wrap `enrichTool` with stage logging:

| Section | Stage |
|---|---|
| Direct HTTP fetch (resolveWebsite) | `FETCH` |
| Jina Reader fallback | `FETCH` |
| Logo resolution | `RESOLVE_URL` |

### Step 6: Integrate into `lib/analyze/index.ts`

Wrap `runAnalysisPipeline` with stage logging:

| Section | Stage |
|---|---|
| For each tool being analyzed | `AI_ANALYSIS` |
| Saving analysis to DB | `SAVE` |

### Step 7: Add stage entries to PipelineSummary

In `processHomepageContent`, collect stage entries into an array and return it as part of the summary. In `runScrapePipeline`, do the same. In `runAnalysisPipeline`, add an optional `stages` field to `AnalysisSummary`.

**Important:** The `stages` field must be optional on all interfaces to avoid breaking existing consumers.

## Security Requirements

- `logStageStart` and `logStageEnd` use the existing `insertLog` function which uses the service role client server-side only — no security changes needed.
- Do not expose stage data to the client/browser.
- All stage logging is server-side only (files already import `'server-only'` or run in API routes).

## Acceptance Criteria

1. `PipelineStage` type is defined with all 7 stage names.
2. `StageLogEntry` interface is defined with stage, startTime, endTime, durationMs, status, optional error.
3. `logStageStart()` and `logStageEnd()` are defined and work correctly together (durationMs computed automatically).
4. `processHomepageContent` logs `EXTRACT`, `NORMALIZE`, `FETCH`, `STORE` stages.
5. `runScrapePipeline` logs `FETCH` stages for homepage fetches.
6. `syncSchedules` logs `NORMALIZE` stages.
7. `processScheduledResults` logs `FETCH` stages for Oxylabs job results.
8. `enrichTool` logs `FETCH` and `RESOLVE_URL` stages.
9. `runAnalysisPipeline` logs `AI_ANALYSIS` and `SAVE` stages.
10. All existing `console.log` calls remain unchanged.
11. New types do not break `PipelineSummary` — `stages` is optional.

## Checks to Run

- `npm run typecheck` — TypeScript no-emit check
- `npm run lint` — ESLint
- `npm run build` — Next.js production build (since multiple files changed)

## Exact Manual Test Steps

1. Run `npm run dev` and watch terminal output.
2. Trigger a manual scrape: `curl -X POST http://localhost:3000/api/scrape -H "x-devscout-admin-secret: YOUR_SECRET" -H "Content-Type: application/json" -d '{"sourceIds": ["<a-source-uuid>"], "perSourceLimit": 1}'`
3. Observe stage logs in the terminal output — look for lines like:
   - `Stage started: EXTRACT`
   - `Stage completed: EXTRACT (XXms)`
   - `Stage failed: FETCH`
4. Trigger AI analysis: `curl -X POST http://localhost:3000/api/analyze -H "x-devscout-admin-secret: YOUR_SECRET" -H "Content-Type: application/json" -d '{"limit": 2}'`
5. Observe `AI_ANALYSIS` and `SAVE` stage logs.
6. Verify logs are also persisted in Supabase by running: `curl http://localhost:3000/api/logs -H "x-devscout-admin-secret: YOUR_SECRET"`
7. Check that existing console logging still appears alongside new stage logs.
