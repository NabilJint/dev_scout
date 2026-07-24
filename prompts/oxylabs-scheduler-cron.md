# Implementation Prompt: Oxylabs Scheduler + Vercel Cron for DevScout AI

## Goal

Implement the Oxylabs Scheduler integration with Vercel Cron for DevScout AI — a Next.js 16 (app router) project. This is the final piece of the scraping infrastructure, enabling fully automatic hourly scraping and AI analysis without manual intervention.

The implementation covers 7 components:

1. **`lib/scrape/oxylabs-scheduler.ts`** — Oxylabs Scheduler API client (Push-Pull API)
2. **`lib/scrape/scheduler.ts`** — Scheduler processing orchestrator
3. **`app/api/oxylabs/schedules/route.ts`** — POST (sync) + GET (list)
4. **`app/api/oxylabs/scheduled-results/process/route.ts`** — POST (manual process)
5. **`app/api/cron/pipeline/route.ts`** — GET (Vercel Cron handler, CRON_SECRET protected)
6. **`vercel.json`** — New file at project root (cron config)
7. **Pipeline refactoring** in `lib/scrape/pipeline.ts` — extract shared `processHomepageContent()` function

**Note**: This prompt covers the full Oxylabs Scheduler + Vercel Cron integration. The manual scrape pipeline (`POST /api/scrape`) and AI analysis pipeline (`POST /api/analyze`) are already implemented and will be reused.

---

## Assigned Specialist Agent(s)

| Agent | Role |
|-------|------|
| **Backend Engineer** (primary) | Implements all modules 1-5, 7 — Oxylabs Scheduler API client, scheduler orchestrator, all API routes, pipeline refactoring |
| **Security Engineer** | Reviews credential handling, CRON_SECRET pattern, admin secret usage on schedule/process routes, orphan schedule deactivation |
| **DevOps Engineer** | Creates `vercel.json` (module 6) — Vercel Cron config for hourly pipeline trigger |
| **Code Reviewer** | Reviews all diffs before merge |
| **QA Engineer** | Runs `typecheck`, `lint`, `build`; provides test commands |

---

## Skills Read

- `.agents/skills/oxylabs-web-scraper` — Oxylabs Web Scraper API Push-Pull endpoint (`POST /v1/queries`), Scheduler API (`/v1/schedules`), HTTP Basic Auth, job result retrieval (`GET /v1/queries/{id}/results`), large integer handling
- `.agents/skills/supabase` — Supabase client creation, service role usage, query patterns, joined table filter gotcha, text storage for large integers
- `node_modules/next/dist/docs/` — Next.js 16 API route patterns, route handlers, edge runtime vs Node.js runtime, Vercel Cron configuration via `vercel.json`

---

## Existing Code Inspected

| File | Key Findings |
|------|--------------|
| `lib/scrape/pipeline.ts` | `runScrapePipeline()` orchestrates full scrape-to-insert flow. Needs refactoring: extract `processHomepageContent()` that takes pre-fetched homepage HTML + sources and runs the common extract → filter → dedupe → detail scrape → validate → insert flow. Currently fetches homepage via Oxylabs Realtime inline. |
| `lib/scrape/oxylabs.ts` | `scrapeUrl()` — Realtime API client. Used for detail page scraping. Will be reused by scheduler for tool detail page scraping. |
| `lib/scrape/types.ts` | `CandidateLink`, `ScrapedTool`, `PipelineSummary`, `Parser` interfaces. `PipelineSummary` has `sourcesErrored` field. |
| `lib/scrape/validate.ts` | `cleanRawText()`, `validateToolContent()` — both reusable as-is. |
| `lib/scrape/middleware.ts` | `verifyAdminSecret()` — reusable for schedule/process routes. |
| `lib/scrape/parsers/index.ts` | `getParser(strategy)` — reusable as-is. |
| `lib/analyze/index.ts` | `runAnalysisPipeline()` — reusable as-is for the cron pipeline's analysis step. |
| `app/api/scrape/route.ts` | Route pattern: Zod validation, `verifyAdminSecret()`, PostHog capture, error handling. Follow this pattern for new routes. |
| `app/api/analyze/route.ts` | Route pattern: Zod validation, `verifyAdminSecret()`, PostHog capture. |
| `lib/supabase/queries/schedules.ts` | `getSchedules()`, `getScheduleById()`, `getScheduleBySourceId()`, `getScheduleByOxylabsId()`, `insertSchedule()`, `updateSchedule()`, `deactivateSchedule()`, `activateSchedule()`, `deleteSchedule()`, `deactivateOrphanSchedules()` — all exist and tested. |
| `lib/supabase/queries/runs.ts` | `getRunsBySchedule()`, `getRunById()`, `getRunByOxylabsRunId()`, `getPendingRuns()`, `getDoneRuns()`, `insertRun()`, `updateRun()`, `markRunStarted()`, `markRunDone()`, `markRunFaulted()` — all exist and tested. |
| `lib/supabase/queries/tools.ts` | `checkToolsExistByOriginalUrls()` (chunks of 15), `insertTool()`, `getPendingAnalysisTools()` — all exist. |
| `lib/supabase/types.ts` | `OxylabsSchedule` (id, oxylabs_schedule_id as TEXT, source_id, active), `OxylabsScheduleRun` (id, schedule_id, oxylabs_run_id as TEXT, status, tools_found/inserted/rejected, error_message), `InsertScheduleParams`, `InsertRunParams`, `UpdateRunParams` — all defined. |
| `supabase/schema.sql` | `oxylabs_schedules` table (oxylabs_schedule_id TEXT for large ints), `oxylabs_schedule_runs` table (oxylabs_run_id TEXT for large ints), RLS, indexes, triggers all in place. |
| `.env.example` | Has `OXY_WSA_USERNAME`, `OXY_WSA_PASSWORD`, `DEVSCOUT_ADMIN_SECRET`. Missing `CRON_SECRET` note. |
| `AGENTS.md` | Sections 14 (API method rules), 15 (admin secret), 18 (Oxylabs Scheduler — full spec), 21 (security, env var table with CRON_SECRET) |

---

## Decisions / Assumptions

1. **Oxylabs Scheduler uses Push-Pull API** (`POST https://data.oxylabs.io/v1/queries`), NOT the Realtime endpoint (`https://realtime.oxylabs.io/v1/queries`). The scheduler creates jobs via Push-Pull, and results are fetched via `GET /v1/queries/{job_id}/results`.
2. **Large integers stored as TEXT**: `schedule_id`, `run_id`, and job `id` from Oxylabs are 64-bit integers exceeding `Number.MAX_SAFE_INTEGER`. They must be extracted from raw HTTP response text via string/regex before `JSON.parse`, and stored as TEXT in the DB. Never convert to JavaScript number.
3. **Use `/runs` not `/jobs` for processing**: `GET /schedules/{id}/runs` returns per-job `result_status`. Filter to `result_status === 'done'` before fetching results. Do NOT use `GET /schedules/{id}/jobs` — it returns flat job IDs with no status.
4. **Pipeline refactoring**: Extract `processHomepageContent(sourcesWithHtml, options?)` from `pipeline.ts`. Both `runScrapePipeline()` (after live Realtime fetch) and the scheduler orchestrator (after fetching scheduler job results) call this shared function. The existing `runScrapePipeline()` signature stays the same — it internally calls `processHomepageContent()`.
5. **One schedule per active source**: Each active `tool_source` gets one Oxylabs schedule. The schedule scrapes that source's homepage URL with `source: "universal"` and `render: "html"` for JS-heavy sources.
6. **Cron expression**: `15 * * * *` — fires at :15 past every hour, giving Oxylabs 15 minutes to complete the scheduled jobs that run at the top of the hour.
7. **End time**: Set `end_time` to 1 year from now as ISO string. This is a reasonable default; the schedule can be recreated later.
8. **CRON_SECRET**: Injected by Vercel automatically on cron requests. In local development (no `CRON_SECRET` in env), skip the check. Do NOT add `CRON_SECRET` to `.env.local`. Do NOT use `DEVSCOUT_ADMIN_SECRET` for the cron route.
9. **PostHog capture**: Include PostHog event capture on schedule sync, process, and cron pipeline routes, following the pattern in `app/api/scrape/route.ts`.
10. **No AI analysis in scheduler processing**: The cron pipeline runs analysis as a separate step after scraping. The scheduler processing route only handles scraping. The cron pipeline chains both.

---

## Files Likely to Change

| File | Action |
|------|--------|
| `lib/scrape/oxylabs-scheduler.ts` | **New** — Oxylabs Scheduler API client (Push-Pull) |
| `lib/scrape/scheduler.ts` | **New** — Scheduler processing orchestrator |
| `lib/scrape/pipeline.ts` | **Update** — Extract `processHomepageContent()` shared function |
| `app/api/oxylabs/schedules/route.ts` | **New** — POST (sync) + GET (list) |
| `app/api/oxylabs/scheduled-results/process/route.ts` | **New** — POST (manual process) |
| `app/api/cron/pipeline/route.ts` | **New** — GET (Vercel Cron handler) |
| `vercel.json` | **New** — Vercel Cron config |
| `.env.example` | **Update** — Add `CRON_SECRET` note |

---

## Implementation Requirements

### Module 0: Project Setup

#### 0.1 Update `.env.example`

Add to `.env.example` after the `DEVSCOUT_ADMIN_SECRET` section:

```env
# --- Vercel Cron Secret ---
# Injected by Vercel automatically on cron requests. Do NOT add to .env.local.
# Protects GET /api/cron/pipeline from unauthorized access.
CRON_SECRET=
```

---

### Module 1: `lib/scrape/oxylabs-scheduler.ts` — Oxylabs Scheduler API Client

Create a new file at `lib/scrape/oxylabs-scheduler.ts`. This is the Push-Pull API client for the Oxylabs Scheduler feature. It uses `https://data.oxylabs.io/v1/` as the base URL (NOT the Realtime endpoint).

**Important**: All functions must handle large 64-bit integers by reading raw HTTP response text before `JSON.parse`. Use a helper function `extractLargeInt(rawText: string, key: string): string` that regex-extracts the value as a string from the raw response body.

```typescript
import 'server-only';

// lib/scrape/oxylabs-scheduler.ts
// Oxylabs Scheduler API client — uses Push-Pull API (data.oxylabs.io)
// All schedule_id, run_id, and job_id values are large 64-bit integers
// that must be extracted from raw response text before JSON.parse.

const OXYLABS_BASE = 'https://data.oxylabs.io/v1';

function getAuthHeaders(): Record<string, string> {
  const username = process.env.OXY_WSA_USERNAME;
  const password = process.env.OXY_WSA_PASSWORD;

  if (!username || !password) {
    throw new Error('OXY_WSA_USERNAME or OXY_WSA_PASSWORD not configured');
  }

  const encoded = Buffer.from(`${username}:${password}`).toString('base64');
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${encoded}`,
  };
}

/**
 * Extract a large integer value from raw JSON response text as a string.
 * Oxylabs IDs (schedule_id, run_id, job id) are 64-bit integers that exceed
 * Number.MAX_SAFE_INTEGER. Parsing with JSON.parse silently corrupts them.
 * This function extracts the value as a string from the raw text before any parse.
 *
 * @param rawText - The raw HTTP response body text
 * @param key - The JSON key to extract (e.g., "schedule_id", "run_id", "id")
 * @returns The value as a string, or null if not found
 */
function extractLargeInt(rawText: string, key: string): string | null {
  // Match "key": <number> — capture the number as a string
  const pattern = new RegExp(`"${key}"\\s*:\\s*(\\d+)`);
  const match = rawText.match(pattern);
  return match ? match[1] : null;
}

/**
 * Extract an array of large integers from raw JSON response text.
 * Used for extracting schedule IDs from GET /v1/schedules response.
 */
function extractLargeIntArray(rawText: string, key: string): string[] {
  // Match "key": [<num1>, <num2>, ...]
  const pattern = new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]+)\\]`);
  const match = rawText.match(pattern);
  if (!match) return [];

  // Extract all digit sequences from the array
  const numbers = match[1].match(/\d+/g);
  return numbers || [];
}

// ============================================================================
// Schedule CRUD
// ============================================================================

export interface CreateScheduleParams {
  cron: string;
  items: Array<{ source: string; url: string; render?: string }>;
  endTime: string; // ISO date string or "YYYY-MM-DD HH:mm:ss" format
}

export interface CreateScheduleResult {
  scheduleId: string; // Stored as string (large int)
  active: boolean;
  itemsCount: number;
  cron: string;
  endTime: string;
  nextRunAt: string | null;
}

/**
 * Create a new Oxylabs schedule.
 * POST /v1/schedules
 */
export async function createSchedule(params: CreateScheduleParams): Promise<CreateScheduleResult> {
  const headers = getAuthHeaders();

  const body = {
    cron: params.cron,
    items: params.items,
    end_time: params.endTime,
  };

  const response = await fetch(`${OXYLABS_BASE}/schedules`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Oxylabs create schedule failed (${response.status}): ${errorText}`);
  }

  const rawText = await response.text();

  // Extract large integers from raw text before JSON.parse
  const scheduleId = extractLargeInt(rawText, 'schedule_id');
  if (!scheduleId) {
    throw new Error('Oxylabs create schedule response missing schedule_id');
  }

  const data = JSON.parse(rawText);

  return {
    scheduleId,
    active: data.active ?? true,
    itemsCount: data.items_count ?? 0,
    cron: data.cron ?? params.cron,
    endTime: data.end_time ?? params.endTime,
    nextRunAt: data.next_run_at ?? null,
  };
}

/**
 * List all Oxylabs schedule IDs associated with the account.
 * GET /v1/schedules
 */
export async function listSchedules(): Promise<string[]> {
  const headers = getAuthHeaders();

  const response = await fetch(`${OXYLABS_BASE}/schedules`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Oxylabs list schedules failed (${response.status}): ${errorText}`);
  }

  const rawText = await response.text();
  return extractLargeIntArray(rawText, 'schedules');
}

/**
 * Get runs for a schedule.
 * GET /v1/schedules/{id}/runs
 * Returns runs with per-job result_status. Filter to result_status === 'done'.
 */
export interface ScheduleRun {
  runId: string; // Large int as string
  jobs: Array<{
    id: string; // Large int as string
    createStatusCode: number;
    resultStatus: 'done' | 'pending' | 'faulted' | string;
    createdAt: string;
    resultCreatedAt: string | null;
  }>;
  successRate: number;
}

export async function getScheduleRuns(scheduleId: string): Promise<ScheduleRun[]> {
  const headers = getAuthHeaders();

  const response = await fetch(`${OXYLABS_BASE}/schedules/${scheduleId}/runs`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Oxylabs get schedule runs failed (${response.status}): ${errorText}`);
  }

  const rawText = await response.text();
  const data = JSON.parse(rawText);

  if (!data.runs || !Array.isArray(data.runs)) {
    return [];
  }

  return data.runs.map((run: Record<string, unknown>) => {
    // Re-extract run_id from raw text for precision
    // We need to find the specific run's run_id
    // Since we already parsed, we'll use the parsed value but convert to string
    // For the jobs array, we need to handle each job's id
    const jobs = (run.jobs as Array<Record<string, unknown>> || []).map(job => ({
      id: String(job.id),
      createStatusCode: (job.create_status_code as number) ?? 202,
      resultStatus: (job.result_status as string) ?? 'pending',
      createdAt: (job.created_at as string) ?? '',
      resultCreatedAt: (job.result_created_at as string | null) ?? null,
    }));

    return {
      runId: String(run.run_id),
      jobs,
      successRate: (run.success_rate as number) ?? 0,
    };
  });
}

/**
 * Get job results from Oxylabs.
 * GET /v1/queries/{jobId}/results
 */
export interface JobResult {
  content: string;
  statusCode: number;
  url: string;
  jobId: string;
}

export async function getJobResults(jobId: string): Promise<JobResult | null> {
  const headers = getAuthHeaders();

  const response = await fetch(`${OXYLABS_BASE}/queries/${jobId}/results`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    console.error(`  ❌ [Oxylabs] Failed to get job results for ${jobId}: HTTP ${response.status}`);
    return null;
  }

  const data = await response.json();

  const result = data?.results?.[0];
  if (!result) {
    console.error(`  ❌ [Oxylabs] No results for job ${jobId}`);
    return null;
  }

  return {
    content: typeof result.content === 'string' ? result.content : '',
    statusCode: result.status_code ?? 200,
    url: result.url ?? '',
    jobId: String(result.job_id ?? jobId),
  };
}

/**
 * Deactivate a schedule on Oxylabs.
 * PUT /v1/schedules/{id}/state with { active: false }
 */
export async function deactivateSchedule(scheduleId: string): Promise<void> {
  const headers = getAuthHeaders();

  const response = await fetch(`${OXYLABS_BASE}/schedules/${scheduleId}/state`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ active: false }),
  });

  if (!response.ok && response.status !== 202) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(`  ⚠️ [Oxylabs] Failed to deactivate schedule ${scheduleId}: HTTP ${response.status} — ${errorText}`);
    // Non-fatal — log and continue
  }
}

/**
 * Get schedule info.
 * GET /v1/schedules/{id}
 */
export async function getScheduleInfo(scheduleId: string): Promise<Record<string, unknown> | null> {
  const headers = getAuthHeaders();

  const response = await fetch(`${OXYLABS_BASE}/schedules/${scheduleId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}
```

---

### Module 2: `lib/scrape/scheduler.ts` — Scheduler Processing Orchestrator

Create a new file at `lib/scrape/scheduler.ts`. This orchestrates the scheduler-specific processing flow:

1. Sync schedules: Create Oxylabs schedules for active sources, clean up orphans
2. Process results: Fetch completed Oxylabs job HTML, extract candidates, run the shared pipeline

```typescript
import 'server-only';

// lib/scrape/scheduler.ts
// Scheduler processing orchestrator.
// Handles: syncing schedules with Oxylabs, processing completed job results.

import type { ToolSource } from '@/lib/supabase/types';
import type { PipelineSummary } from './types';
import { getActiveSources } from '@/lib/supabase/queries/sources';
import {
  getSchedules,
  insertSchedule,
  deactivateSchedule as deactivateDbSchedule,
  getScheduleBySourceId,
} from '@/lib/supabase/queries/schedules';
import { insertRun, markRunStarted, markRunDone, markRunFaulted } from '@/lib/supabase/queries/runs';
import { logInfo, logError } from '@/lib/supabase/queries/logs';
import { processHomepageContent } from './pipeline';
import {
  createSchedule,
  listSchedules,
  getScheduleRuns,
  getJobResults,
  deactivateSchedule as deactivateOxylabsSchedule,
} from './oxylabs-scheduler';

// ============================================================================
// Constants
// ============================================================================

/** Cron expression for hourly scraping at the top of the hour. */
const HOURLY_CRON = '0 * * * *';

/** End time: 1 year from now. */
function getEndTime(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  // Format as "YYYY-MM-DD HH:mm:ss" (Oxylabs format)
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

/** Source names that need JS rendering for the scheduler job. */
const NEEDS_RENDER = new Set([
  'producthunt',
  'reddit',
  'github-trending',
  'saashub',
  'betalist',
]);

// ============================================================================
// Sync Schedules
// ============================================================================

export interface SyncSchedulesSummary {
  status: 'completed' | 'partial' | 'failed';
  sourcesChecked: number;
  schedulesCreated: number;
  schedulesAlreadyExist: number;
  orphansDeactivated: number;
  errors: string[];
}

/**
 * Sync Oxylabs schedules with active sources in Supabase.
 * Creates one schedule per active source. Deactivates orphaned schedules.
 */
export async function syncSchedules(): Promise<SyncSchedulesSummary> {
  console.log('\n🔄 [Scheduler] Syncing schedules with Oxylabs...');

  const errors: string[] = [];
  let schedulesCreated = 0;
  let schedulesAlreadyExist = 0;

  // 1. Load active sources
  const sources = await getActiveSources();
  console.log(`  📊 [Scheduler] Found ${sources.length} active sources`);

  if (sources.length === 0) {
    console.log('  ⚠️  [Scheduler] No active sources found');
    return {
      status: 'completed',
      sourcesChecked: 0,
      schedulesCreated: 0,
      schedulesAlreadyExist: 0,
      orphansDeactivated: 0,
      errors: [],
    };
  }

  // 2. Create/ensure schedules for each active source
  for (const source of sources) {
    try {
      const existing = await getScheduleBySourceId(source.id);

      if (existing && existing.active) {
        console.log(`  ℹ️  [Scheduler] Schedule already exists for ${source.name} (DB id: ${existing.id})`);
        schedulesAlreadyExist++;
        continue;
      }

      // Create a new Oxylabs schedule
      const items = [{
        source: 'universal',
        url: source.listing_url,
        ...(NEEDS_RENDER.has(source.parser_strategy || '') ? { render: 'html' } : {}),
      }];

      const result = await createSchedule({
        cron: HOURLY_CRON,
        items,
        endTime: getEndTime(),
      });

      // Store in DB
      await insertSchedule({
        oxylabs_schedule_id: result.scheduleId,
        source_id: source.id,
        active: true,
      });

      schedulesCreated++;
      console.log(`  ✅ [Scheduler] Created schedule for ${source.name} (Oxylabs ID: ${result.scheduleId})`);
    } catch (err) {
      const msg = `Failed to create schedule for ${source.name}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`  ❌ [Scheduler] ${msg}`);
      errors.push(msg);
    }
  }

  // 3. Orphan schedule cleanup
  let orphansDeactivated = 0;
  try {
    orphansDeactivated = await cleanupOrphanSchedules();
  } catch (err) {
    const msg = `Orphan cleanup failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`  ❌ [Scheduler] ${msg}`);
    errors.push(msg);
  }

  const status: SyncSchedulesSummary['status'] =
    errors.length === 0 ? 'completed'
    : schedulesCreated > 0 ? 'partial'
    : 'failed';

  const summary: SyncSchedulesSummary = {
    status,
    sourcesChecked: sources.length,
    schedulesCreated,
    schedulesAlreadyExist,
    orphansDeactivated,
    errors,
  };

  console.log(`\n📊 [Scheduler] Sync summary: ${JSON.stringify(summary, null, 2)}`);

  try {
    await logInfo('Scheduler sync completed', { summary });
  } catch {
    // non-critical
  }

  return summary;
}

/**
 * Clean up orphaned schedules on Oxylabs.
 * 1. List all Oxylabs schedule IDs
 * 2. Compare against DB records
 * 3. Deactivate any Oxylabs schedule not in DB
 */
async function cleanupOrphanSchedules(): Promise<number> {
  console.log('  🔍 [Scheduler] Checking for orphan schedules...');

  const oxylabsIds = await listSchedules();
  console.log(`  📊 [Scheduler] Found ${oxylabsIds.length} schedules on Oxylabs`);

  if (oxylabsIds.length === 0) return 0;

  // Get all active schedules from DB
  const dbSchedules = await getSchedules(true);
  const dbOxylabsIds = new Set(dbSchedules.map(s => s.oxylabs_schedule_id));

  // Find orphans: Oxylabs schedules not in DB
  const orphanIds = oxylabsIds.filter(id => !dbOxylabsIds.has(id));

  if (orphanIds.length === 0) {
    console.log('  ✅ [Scheduler] No orphan schedules found');
    return 0;
  }

  console.log(`  ⚠️  [Scheduler] Found ${orphanIds.length} orphan schedules, deactivating...`);

  for (const id of orphanIds) {
    try {
      await deactivateOxylabsSchedule(id);
      console.log(`    ✅ [Scheduler] Deactivated orphan schedule ${id}`);
    } catch (err) {
      console.error(`    ❌ [Scheduler] Failed to deactivate orphan schedule ${id}: ${err}`);
    }
  }

  return orphanIds.length;
}

// ============================================================================
// Process Scheduled Results
// ============================================================================

export interface ProcessResultsSummary {
  status: 'completed' | 'partial' | 'failed';
  schedulesProcessed: number;
  runsFound: number;
  doneJobsFound: number;
  jobsFetched: number;
  sourcesWithHtml: number;
  pipelineSummary: PipelineSummary | null;
  errors: string[];
}

/**
 * Process completed Oxylabs scheduler job results.
 * Fetches completed job HTML from Oxylabs, then runs the shared pipeline.
 */
export async function processScheduledResults(): Promise<ProcessResultsSummary> {
  console.log('\n📡 [Scheduler] Processing scheduled results...');

  const errors: string[] = [];
  let schedulesProcessed = 0;
  let runsFound = 0;
  let doneJobsFound = 0;
  let jobsFetched = 0;

  // 1. Load active schedules from DB
  const dbSchedules = await getSchedules(true);
  console.log(`  📊 [Scheduler] Found ${dbSchedules.length} active schedules in DB`);

  if (dbSchedules.length === 0) {
    console.log('  ⚠️  [Scheduler] No active schedules found — run sync first');
    return {
      status: 'completed',
      schedulesProcessed: 0,
      runsFound: 0,
      doneJobsFound: 0,
      jobsFetched: 0,
      sourcesWithHtml: 0,
      pipelineSummary: null,
      errors: [],
    };
  }

  // 2. For each schedule, fetch runs and find done jobs
  const sourcesWithHtml: Array<{ source: ToolSource; html: string }> = [];

  for (const dbSchedule of dbSchedules) {
    try {
      console.log(`  📡 [Scheduler] Checking schedule ${dbSchedule.oxylabs_schedule_id}...`);

      const runs = await getScheduleRuns(dbSchedule.oxylabs_schedule_id);
      runsFound += runs.length;

      if (runs.length === 0) {
        console.log(`    ℹ️  [Scheduler] No runs found for schedule ${dbSchedule.oxylabs_schedule_id}`);
        continue;
      }

      // Get the most recent run
      const latestRun = runs[0];
      const doneJobs = latestRun.jobs.filter(j => j.resultStatus === 'done');
      doneJobsFound += doneJobs.length;

      if (doneJobs.length === 0) {
        console.log(`    ⏳ [Scheduler] No done jobs in latest run (run ${latestRun.runId})`);
        continue;
      }

      console.log(`    📊 [Scheduler] Run ${latestRun.runId}: ${doneJobs.length} done jobs`);

      // Fetch results for each done job
      for (const job of doneJobs) {
        try {
          const result = await getJobResults(job.id);
          if (result && result.content) {
            // We need the source info to pass to the pipeline
            // The schedule's source_id maps to a tool_source
            // We'll fetch the source separately
            jobsFetched++;
            console.log(`    ✅ [Scheduler] Fetched result for job ${job.id} (${result.statusCode})`);

            // Store HTML with source reference — we'll resolve sources below
            // For now, we store the HTML and resolve the source later
            sourcesWithHtml.push({
              source: { id: dbSchedule.source_id } as ToolSource, // placeholder, resolved below
              html: result.content,
            });
          } else {
            console.warn(`    ⚠️  [Scheduler] Empty result for job ${job.id}`);
          }
        } catch (err) {
          const msg = `Failed to fetch job ${job.id}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`    ❌ [Scheduler] ${msg}`);
          errors.push(msg);
        }
      }

      schedulesProcessed++;
    } catch (err) {
      const msg = `Failed to process schedule ${dbSchedule.oxylabs_schedule_id}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`  ❌ [Scheduler] ${msg}`);
      errors.push(msg);
    }
  }

  if (sourcesWithHtml.length === 0) {
    console.log('  ⚠️  [Scheduler] No completed job results to process');
    return {
      status: 'completed',
      schedulesProcessed,
      runsFound,
      doneJobsFound,
      jobsFetched,
      sourcesWithHtml: 0,
      pipelineSummary: null,
      errors,
    };
  }

  // 3. Resolve full source objects for each HTML result
  // We need to load the actual ToolSource records for the schedule's source_ids
  const { getSourceById } = await import('@/lib/supabase/queries/sources');

  const resolvedSourcesWithHtml: Array<{ source: ToolSource; html: string }> = [];
  for (const item of sourcesWithHtml) {
    const source = await getSourceById(item.source.id);
    if (source) {
      resolvedSourcesWithHtml.push({ source, html: item.html });
    } else {
      console.warn(`  ⚠️  [Scheduler] Source ${item.source.id} not found in DB`);
    }
  }

  // 4. Run the shared pipeline on the fetched HTML
  console.log(`\n  🔄 [Scheduler] Running pipeline on ${resolvedSourcesWithHtml.length} source homepages...`);

  let pipelineSummary: PipelineSummary | null = null;
  try {
    pipelineSummary = await processHomepageContent(resolvedSourcesWithHtml);
    console.log(`  ✅ [Scheduler] Pipeline completed: ${pipelineSummary.toolsInserted} tools inserted`);
  } catch (err) {
    const msg = `Pipeline error: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`  ❌ [Scheduler] ${msg}`);
    errors.push(msg);
  }

  const status: ProcessResultsSummary['status'] =
    errors.length === 0 ? 'completed'
    : pipelineSummary && pipelineSummary.toolsInserted > 0 ? 'partial'
    : 'failed';

  const summary: ProcessResultsSummary = {
    status,
    schedulesProcessed,
    runsFound,
    doneJobsFound,
    jobsFetched,
    sourcesWithHtml: resolvedSourcesWithHtml.length,
    pipelineSummary,
    errors,
  };

  console.log(`\n📊 [Scheduler] Process summary: ${JSON.stringify(summary, null, 2)}`);

  try {
    await logInfo('Scheduler process completed', { summary });
  } catch {
    // non-critical
  }

  return summary;
}
```

---

### Module 3: Pipeline Refactoring (`lib/scrape/pipeline.ts`)

**Update** the existing `lib/scrape/pipeline.ts` to extract a shared `processHomepageContent()` function. The existing `runScrapePipeline()` function should remain with the same signature and behavior — it internally calls `processHomepageContent()` after fetching homepage HTML via Oxylabs Realtime.

#### What to extract

Extract the core logic from `runScrapePipeline()` that runs **after** homepage HTML is obtained (steps 4-12 in the pipeline flow per AGENTS.md Section 9). The new function signature:

```typescript
/**
 * Process pre-fetched homepage HTML content through the scrape-to-insert pipeline.
 *
 * This is the shared core of both manual scraping (runScrapePipeline) and
 * scheduler processing (processScheduledResults). It takes sources with their
 * already-fetched homepage HTML and runs the common flow:
 * extract candidates → filter → dedupe → detail scrape → validate → insert.
 *
 * @param sourcesWithHtml - Array of sources paired with their homepage HTML content
 * @param options - Optional perSourceLimit (default 5)
 * @returns PipelineSummary with status and counts
 */
export async function processHomepageContent(
  sourcesWithHtml: Array<{ source: ToolSource; html: string }>,
  options?: { perSourceLimit?: number }
): Promise<PipelineSummary>
```

#### Refactoring approach

1. Keep all existing imports, constants (`NEEDS_RENDER`, `DEFAULT_PER_SOURCE_LIMIT`, `NON_TOOL_PATTERNS`), and helper functions (`normalizeUrl`, `rejectNonToolUrl`, `sourceNeedsRender`, `formatDuration`, `emptySummary`) as-is.

2. Extract the inner loop body (the per-source processing logic from after homepage fetch to the end of the source loop) into `processHomepageContent()`.

3. Refactor `runScrapePipeline()` to:
   - Fetch homepage HTML for each source (existing steps 1-3)
   - Build `sourcesWithHtml` array
   - Call `return processHomepageContent(sourcesWithHtml, options)`

4. The `processHomepageContent()` function should:
   - Accept `Array<{ source: ToolSource; html: string }>` — sources with pre-fetched HTML
   - Run the same extract → filter → dedupe → detail scrape → validate → insert flow
   - Use the same logging emoji conventions
   - Return the same `PipelineSummary` structure
   - Log to Supabase on completion

5. **Important**: The `processHomepageContent()` function must still call `scrapeUrl()` for tool **detail pages** (step 8 in the pipeline). Only the homepage HTML is pre-fetched; detail pages still need live scraping.

#### Code structure after refactoring

```typescript
// lib/scrape/pipeline.ts

// ... existing imports, constants, helpers remain unchanged ...

/**
 * Run the scrape-to-insert pipeline for the given sources.
 * Fetches homepage HTML via Oxylabs Realtime, then delegates to processHomepageContent.
 */
export async function runScrapePipeline(
  sources: ToolSource[],
  options?: { perSourceLimit?: number }
): Promise<PipelineSummary> {
  const limit = options?.perSourceLimit ?? DEFAULT_PER_SOURCE_LIMIT;
  const startTime = performance.now();

  if (sources.length === 0) {
    return emptySummary();
  }

  // Fetch homepage HTML for each source
  const sourcesWithHtml: Array<{ source: ToolSource; html: string }> = [];
  let sourcesErrored = 0;

  for (const source of sources) {
    const strategy = source.parser_strategy;

    if (!strategy) {
      console.warn(`  ⚠️  [Scrape] Source "${source.name}" has no parser_strategy — skipping`);
      continue;
    }

    const parser = getParser(strategy);
    if (!parser) {
      console.warn(`  ⚠️  [Scrape] No parser found for strategy "${strategy}" (source: "${source.name}") — skipping`);
      continue;
    }

    console.log(`\n📡 [Scrape] Starting scrape for ${source.name}...`);

    const render = sourceNeedsRender(strategy);
    const homepageResult = await scrapeUrl(source.listing_url, { render });

    if (homepageResult.error) {
      sourcesErrored++;
      console.error(`  ❌ [Scrape] Error fetching homepage for ${source.name}: ${homepageResult.error}`);
      await logError(`Scrape error for ${source.name}`, {
        source: source.name,
        listingUrl: source.listing_url,
        error: homepageResult.error,
      });
      continue;
    }

    console.log(`  📄 [Scrape] Homepage fetched for ${source.name} (${source.listing_url})`);

    if (!homepageResult.content) {
      console.warn(`  ⚠️  [Scrape] Empty homepage content for ${source.name}`);
      continue;
    }

    sourcesWithHtml.push({ source, html: homepageResult.content });
  }

  // Delegate to shared processing function
  const summary = await processHomepageContent(sourcesWithHtml, { perSourceLimit: limit });

  // Adjust status based on source fetch errors
  if (sourcesErrored > 0 && summary.sourcesChecked === 0) {
    summary.status = 'failed';
  } else if (sourcesErrored > 0) {
    summary.status = 'partial';
  }

  // Add sourcesErrored to the summary
  (summary as PipelineSummary & { sourcesErrored: number }).sourcesErrored = sourcesErrored;

  const endTime = performance.now();
  summary.totalDuration = formatDuration(startTime, endTime);

  console.log(`\n📊 [Scrape] Pipeline summary: ${JSON.stringify(summary, null, 2)}`);

  // Log to Supabase
  try {
    await logInfo('Scrape pipeline completed', {
      summary: summary as unknown as Json,
      sourceCount: sources.length,
      sourceNames: sources.map(s => s.name),
    } as Record<string, Json>);
  } catch {
    // non-critical
  }

  return summary;
}

/**
 * Process pre-fetched homepage HTML through the scrape-to-insert pipeline.
 * Shared between manual scraping and scheduler processing.
 *
 * Steps per AGENTS.md Section 9:
 * 4. Extract candidates from homepage HTML
 * 5. Reject non-tool URLs
 * 6. Normalize and dedupe URLs
 * 7. Check existing in Supabase
 * 8. Scrape tool detail pages
 * 9. Validate and clean
 * 10. Insert valid tools
 * 11. Log progress
 * 12. Return summary
 */
export async function processHomepageContent(
  sourcesWithHtml: Array<{ source: ToolSource; html: string }>,
  options?: { perSourceLimit?: number }
): Promise<PipelineSummary> {
  const limit = options?.perSourceLimit ?? DEFAULT_PER_SOURCE_LIMIT;

  // Accumulators
  let candidatesFound = 0;
  let candidatesRejected = 0;
  let duplicatesSkipped = 0;
  let detailPagesScraped = 0;
  let toolsInserted = 0;
  let toolsRejected = 0;
  let toolsFailed = 0;
  const rejectionReasons: Record<string, number> = {};
  let sourcesChecked = 0;

  if (sourcesWithHtml.length === 0) {
    return emptySummary();
  }

  for (const { source, html } of sourcesWithHtml) {
    const strategy = source.parser_strategy;

    // ---- Step 1: Determine parser ----
    if (!strategy) {
      console.warn(`  ⚠️  [Pipeline] Source "${source.name}" has no parser_strategy — skipping`);
      continue;
    }

    const parser = getParser(strategy);
    if (!parser) {
      console.warn(`  ⚠️  [Pipeline] No parser found for strategy "${strategy}" (source: "${source.name}") — skipping`);
      continue;
    }

    sourcesChecked++;
    console.log(`\n📡 [Pipeline] Processing ${source.name}...`);

    // ---- Step 4: Extract candidates ----
    let candidates: CandidateLink[];
    try {
      candidates = parser.extractCandidates(html);
    } catch (err) {
      console.error(`  ❌ [Pipeline] Parser error extracting candidates from ${source.name}: ${err}`);
      await logError(`Parser error for ${source.name}`, {
        source: source.name,
        error: String(err),
      });
      continue;
    }

    console.log(`  🔗 [Pipeline] Found ${candidates.length} candidate links on ${source.name}`);
    candidatesFound += candidates.length;

    if (candidates.length === 0) {
      console.log(`  ⚠️  [Pipeline] No candidates found on ${source.name} — skipping`);
      continue;
    }

    // ---- Step 5: Reject non-tool URLs ----
    const filteredCandidates: CandidateLink[] = [];
    let sourceRejected = 0;

    for (const candidate of candidates) {
      const normalizedUrl = normalizeUrl(candidate.url);

      if (!parser.isToolUrl(normalizedUrl)) {
        sourceRejected++;
        continue;
      }

      const rejectReason = rejectNonToolUrl(normalizedUrl);
      if (rejectReason) {
        sourceRejected++;
        continue;
      }

      filteredCandidates.push({ ...candidate, url: normalizedUrl });
    }

    candidatesRejected += sourceRejected;
    if (sourceRejected > 0) {
      const reason = 'non_tool_page';
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + sourceRejected;
      console.log(`  ❌ [Pipeline] Rejected ${sourceRejected} candidates on ${source.name} (not a tool URL)`);
    }

    // ---- Step 6: Dedupe within source ----
    const seenInSource = new Set<string>();
    const dedupedCandidates: CandidateLink[] = [];

    for (const candidate of filteredCandidates) {
      const key = candidate.url.toLowerCase();
      if (seenInSource.has(key)) {
        duplicatesSkipped++;
        continue;
      }
      seenInSource.add(key);
      dedupedCandidates.push(candidate);
    }

    const sourceDupes = filteredCandidates.length - dedupedCandidates.length;
    if (sourceDupes > 0) {
      console.log(`  🔁 [Pipeline] Skipped ${sourceDupes} duplicates on ${source.name} (within source)`);
    }

    // ---- Step 7: Check existing in Supabase ----
    const candidateUrls = dedupedCandidates.map(c => c.url);
    const existingUrls = await checkToolsExistByOriginalUrls(candidateUrls);
    const newCandidates = dedupedCandidates.filter(c => !existingUrls.has(c.url));

    const dbDupes = dedupedCandidates.length - newCandidates.length;
    duplicatesSkipped += dbDupes;
    if (dbDupes > 0) {
      console.log(`  🔁 [Pipeline] Skipped ${dbDupes} duplicates on ${source.name} (already in DB)`);
    }

    // Apply per-source limit
    let candidatesToProcess = newCandidates;
    if (limit > 0 && candidatesToProcess.length > limit) {
      console.log(`  📐 [Pipeline] Limiting ${source.name} from ${candidatesToProcess.length} to ${limit}`);
      candidatesToProcess = candidatesToProcess.slice(0, limit);
    }

    if (candidatesToProcess.length === 0) {
      console.log(`  ⚠️  [Pipeline] No new candidates to process on ${source.name}`);
      continue;
    }

    // ---- Step 8: Scrape tool detail pages ----
    console.log(`  📄 [Pipeline] Fetching ${candidatesToProcess.length} detail pages from ${source.name}...`);

    for (const candidate of candidatesToProcess) {
      const detailResult = await scrapeUrl(candidate.url, { render: true });

      if (detailResult.error) {
        console.error(`    ❌ [Pipeline] Failed to fetch detail: ${candidate.url} — ${detailResult.error}`);
        toolsFailed++;
        continue;
      }

      detailPagesScraped++;

      // ---- Extract tool content ----
      let scrapedTool: ScrapedTool | null = null;
      try {
        scrapedTool = parser.extractToolContent(detailResult.content);
      } catch (err) {
        console.error(`    ❌ [Pipeline] Parser error extracting tool content from ${candidate.url}: ${err}`);
        toolsFailed++;
        continue;
      }

      if (!scrapedTool) {
        console.error(`    ❌ [Pipeline] Failed to parse tool content from ${candidate.url}`);
        toolsFailed++;
        continue;
      }

      // ---- Set websiteUrl from candidate ----
      if (!scrapedTool.websiteUrl) {
        if (candidate.websiteUrl) {
          scrapedTool.websiteUrl = candidate.websiteUrl;
        } else if (source.name === 'GitHub Trending') {
          scrapedTool.websiteUrl = candidate.url;
        } else {
          try {
            const parsedCandidate = new URL(candidate.url);
            const sourceDomain = new URL(source.listing_url).hostname;
            if (parsedCandidate.hostname !== sourceDomain) {
              scrapedTool.websiteUrl = candidate.url;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      // ---- Enrichment step ----
      const { enrichTool } = await import('@/lib/enrichment');
      let contentSource: 'detail' | 'enrichment' = 'detail';
      if (scrapedTool.websiteUrl) {
        console.log(`    🔍 [Pipeline] Enriching from tool website: ${scrapedTool.websiteUrl}`);
        const enrichment = await enrichTool({
          name: scrapedTool.title,
          websiteUrl: scrapedTool.websiteUrl,
        });

        if (enrichment.content) {
          if (enrichment.content.rawText.length > 200) {
            scrapedTool.rawText = enrichment.content.rawText;
            contentSource = 'enrichment';
            console.log(`    ✅ [Pipeline] Enriched raw text (${enrichment.content.rawText.length} chars) from ${scrapedTool.websiteUrl} (source: ${enrichment.content.source})`);
          }

          if (!scrapedTool.imageUrl && enrichment.content.ogImage) {
            scrapedTool.imageUrl = enrichment.content.ogImage;
          }
        }

        if (enrichment.logo?.url && enrichment.logo.source !== 'none') {
          scrapedTool.imageUrl = enrichment.logo.url;
        }
      }

      // ---- Clean raw text ----
      if (contentSource === 'detail') {
        const cleanedRawText = cleanRawText(detailResult.content);
        scrapedTool.rawText = cleanedRawText;
      }

      // ---- Validate ----
      const validation = validateToolContent(scrapedTool);
      if (!validation.valid) {
        const reason = validation.reason || 'unknown';
        rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
        toolsRejected++;
        console.log(`    ❌ [Pipeline] Rejected "${scrapedTool.title}" from ${source.name} (${reason})`);
        continue;
      }

      // ---- Insert ----
      try {
        const insertParams: InsertToolParams = {
          source_id: source.id,
          original_url: candidate.url,
          canonical_url: candidate.url,
          name: scrapedTool.title,
          brand_text: null,
          image_url: scrapedTool.imageUrl,
          website_url: scrapedTool.websiteUrl || null,
          curation_status: 'auto-suggested',
          last_updated: scrapedTool.lastUpdated,
          raw_text: scrapedTool.rawText,
        };

        const inserted = await insertTool(insertParams);
        toolsInserted++;
        console.log(`    ✅ [Pipeline] Inserted "${inserted.name}" from ${source.name}`);
      } catch (err) {
        console.error(`    ❌ [Pipeline] DB insert failed for "${scrapedTool.title}" from ${source.name}: ${err}`);
        toolsFailed++;
      }
    }

    console.log(`  📊 [Pipeline] Source "${source.name}" done: ${toolsInserted} inserted, ${toolsRejected} rejected, ${toolsFailed} failed`);
  }

  // Determine status
  let status: PipelineSummary['status'] = 'completed';
  if (sourcesChecked > 0 && toolsInserted === 0 && candidatesFound === 0) {
    status = 'completed'; // All sources returned content but found no candidates
  }

  return {
    status,
    sourcesChecked,
    sourcesErrored: 0, // processHomepageContent doesn't track source fetch errors
    candidatesFound,
    candidatesRejected,
    duplicatesSkipped,
    detailPagesScraped,
    toolsInserted,
    toolsRejected,
    toolsFailed,
    totalDuration: '0ms', // Caller sets this
    rejectionReasons,
  };
}
```

**Important refactoring notes:**

- The `processHomepageContent()` function does NOT track `sourcesErrored` — that's the caller's responsibility (the homepage fetch step). Set it to 0 in the returned summary.
- The `totalDuration` is set by the caller after `processHomepageContent()` returns. Set it to `'0ms'` as a placeholder.
- The enrichment import (`enrichTool`) uses dynamic `import()` to avoid circular dependencies. This is acceptable since enrichment is only called during pipeline execution, not at module load time.
- The `PipelineSummary` type already has `sourcesErrored` — ensure the returned object includes it.

---

### Module 4: `app/api/oxylabs/schedules/route.ts` — POST (sync) + GET (list)

Create a new file at `app/api/oxylabs/schedules/route.ts`. This route handles two methods:

- **POST** — Sync schedules: creates Oxylabs schedules for active sources, cleans up orphans
- **GET** — List schedules: returns stored schedule rows from DB

```typescript
// app/api/oxylabs/schedules/route.ts
// POST /api/oxylabs/schedules — Sync schedules with Oxylabs
// GET /api/oxylabs/schedules — List stored schedules

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSecret } from '@/lib/scrape/middleware';
import { syncSchedules } from '@/lib/scrape/scheduler';
import { getSchedules } from '@/lib/supabase/queries/schedules';
import { getPostHogClient } from '@/lib/posthog-server';

/**
 * POST /api/oxylabs/schedules
 * Sync schedules: creates one Oxylabs schedule per active source,
 * deactivates orphan schedules on Oxylabs.
 * Requires x-devscout-admin-secret header.
 */
export async function POST(request: NextRequest) {
  const auth = verifyAdminSecret(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const posthog = getPostHogClient();
  try {
    const summary = await syncSchedules();
    posthog.capture({
      distinctId: 'server',
      event: 'scheduler_sync_completed',
      properties: {
        status: summary.status,
        schedules_created: summary.schedulesCreated,
        orphans_deactivated: summary.orphansDeactivated,
        errors: summary.errors.length,
      },
    });
    await posthog.flush();
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    console.error('[Schedules] Sync error:', err);
    posthog.capture({
      distinctId: 'server',
      event: 'scheduler_sync_completed',
      properties: { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' },
    });
    await posthog.flush();
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/oxylabs/schedules
 * List stored schedules from the database.
 * Requires x-devscout-admin-secret header.
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminSecret(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  try {
    const schedules = await getSchedules();
    return NextResponse.json({ success: true, schedules });
  } catch (err) {
    console.error('[Schedules] List error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

---

### Module 5: `app/api/oxylabs/scheduled-results/process/route.ts` — POST (manual process)

Create a new file at `app/api/oxylabs/scheduled-results/process/route.ts`. This route allows manual triggering of scheduled result processing.

```typescript
// app/api/oxylabs/scheduled-results/process/route.ts
// POST /api/oxylabs/scheduled-results/process — Manually process scheduled results
// Requires x-devscout-admin-secret header.

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSecret } from '@/lib/scrape/middleware';
import { processScheduledResults } from '@/lib/scrape/scheduler';
import { getPostHogClient } from '@/lib/posthog-server';

export async function POST(request: NextRequest) {
  const auth = verifyAdminSecret(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const posthog = getPostHogClient();
  try {
    const summary = await processScheduledResults();
    posthog.capture({
      distinctId: 'server',
      event: 'scheduler_process_completed',
      properties: {
        status: summary.status,
        schedules_processed: summary.schedulesProcessed,
        done_jobs_found: summary.doneJobsFound,
        tools_inserted: summary.pipelineSummary?.toolsInserted ?? 0,
        errors: summary.errors.length,
      },
    });
    await posthog.flush();
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    console.error('[ScheduledResults] Process error:', err);
    posthog.capture({
      distinctId: 'server',
      event: 'scheduler_process_completed',
      properties: { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' },
    });
    await posthog.flush();
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

---

### Module 6: `app/api/cron/pipeline/route.ts` — GET (Vercel Cron Handler)

Create a new file at `app/api/cron/pipeline/route.ts`. This is the Vercel Cron route that chains scheduled result processing + AI analysis.

**CRON_SECRET rules:**
- Protected by `CRON_SECRET` env var (injected by Vercel on cron requests)
- In local development (no `CRON_SECRET` in env), skip the check
- Do NOT use `DEVSCOUT_ADMIN_SECRET` for this route
- Do NOT add `CRON_SECRET` to `.env.local`

```typescript
// app/api/cron/pipeline/route.ts
// GET /api/cron/pipeline — Vercel Cron handler for automatic hourly pipeline.
// Protected by CRON_SECRET (injected by Vercel automatically on cron requests).
// In local development, skip the secret check.
//
// Flow:
// 1. Sync schedules (ensure schedules exist for active sources)
// 2. Process scheduled results (fetch completed Oxylabs job HTML, run pipeline)
// 3. Run AI analysis on newly inserted tools
// 4. If step 2 fails, step 3 still runs (there may be pre-existing unanalyzed tools)

import { NextRequest, NextResponse } from 'next/server';
import { syncSchedules, processScheduledResults } from '@/lib/scrape/scheduler';
import { runAnalysisPipeline } from '@/lib/analyze';
import { getPostHogClient } from '@/lib/posthog-server';

function verifyCronSecret(request: NextRequest): { valid: boolean; error?: string } {
  const expected = process.env.CRON_SECRET;

  // In local development, skip the check
  if (!expected) {
    console.log('[Cron] CRON_SECRET not set — skipping auth check (local development)');
    return { valid: true };
  }

  const secret = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace('Bearer ', '') || '';

  if (secret !== expected) {
    return { valid: false, error: 'Invalid cron secret' };
  }

  return { valid: true };
}

export async function GET(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  console.log('\n⏰ [Cron] Starting automatic pipeline...');
  const startTime = performance.now();

  const posthog = getPostHogClient();
  const results: {
    sync: { status: string; error?: string } | null;
    scrape: { status: string; toolsInserted?: number; error?: string } | null;
    analysis: { status: string; analyzed?: number; error?: string } | null;
  } = {
    sync: null,
    scrape: null,
    analysis: null,
  };

  // Step 1: Sync schedules
  try {
    console.log('\n🔄 [Cron] Step 1/3: Syncing schedules...');
    const syncSummary = await syncSchedules();
    results.sync = { status: syncSummary.status };
    console.log(`  ✅ [Cron] Sync completed: ${syncSummary.schedulesCreated} created, ${syncSummary.orphansDeactivated} orphans deactivated`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ [Cron] Sync failed: ${msg}`);
    results.sync = { status: 'failed', error: msg };
  }

  // Step 2: Process scheduled results
  let scrapeFailed = false;
  try {
    console.log('\n🔄 [Cron] Step 2/3: Processing scheduled results...');
    const processSummary = await processScheduledResults();
    results.scrape = {
      status: processSummary.status,
      toolsInserted: processSummary.pipelineSummary?.toolsInserted ?? 0,
    };
    console.log(`  ✅ [Cron] Process completed: ${results.scrape.toolsInserted} tools inserted`);

    if (processSummary.status === 'failed') {
      scrapeFailed = true;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ [Cron] Process failed: ${msg}`);
    results.scrape = { status: 'failed', error: msg };
    scrapeFailed = true;
  }

  // Step 3: Run AI analysis (runs even if step 2 failed)
  try {
    console.log('\n🔄 [Cron] Step 3/3: Running AI analysis...');
    const analysisSummary = await runAnalysisPipeline();
    results.analysis = {
      status: analysisSummary.status,
      analyzed: analysisSummary.analyzed,
    };
    console.log(`  ✅ [Cron] Analysis completed: ${analysisSummary.analyzed} analyzed, ${analysisSummary.failed} failed`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ [Cron] Analysis failed: ${msg}`);
    results.analysis = { status: 'failed', error: msg };
  }

  const totalDuration = Math.round(performance.now() - startTime);
  console.log(`\n⏰ [Cron] Pipeline completed in ${totalDuration}ms`);

  posthog.capture({
    distinctId: 'server',
    event: 'cron_pipeline_completed',
    properties: {
      sync_status: results.sync?.status,
      scrape_status: results.scrape?.status,
      analysis_status: results.analysis?.status,
      tools_inserted: results.scrape?.toolsInserted ?? 0,
      tools_analyzed: results.analysis?.analyzed ?? 0,
      total_duration_ms: totalDuration,
    },
  });
  await posthog.flush();

  return NextResponse.json({
    success: true,
    results,
    totalDurationMs: totalDuration,
  });
}
```

---

### Module 7: `vercel.json` — Vercel Cron Config

Create a new file at project root `vercel.json`. This configures Vercel Cron to call `/api/cron/pipeline` at :15 past every hour.

```json
{
  "crons": [
    {
      "path": "/api/cron/pipeline",
      "schedule": "15 * * * *"
    }
  ]
}
```

**Important notes:**
- The cron fires at `:15` past every hour, giving Oxylabs 15 minutes to complete the scheduled jobs that run at the top of the hour.
- Vercel automatically injects the `CRON_SECRET` environment variable on cron requests. The cron route checks this secret.
- This is a one-time setup. Once deployed, the pipeline runs automatically every hour.
- In local development, the cron won't fire (Vercel Cron only runs in production). Test the cron route manually using the test steps below.

---

## Security Requirements

- [ ] `OXY_WSA_USERNAME` and `OXY_WSA_PASSWORD` are server-only — never exposed to browser
- [ ] `DEVSCOUT_ADMIN_SECRET` is server-only — used for `POST /api/oxylabs/schedules` and `POST /api/oxylabs/scheduled-results/process`
- [ ] `CRON_SECRET` is server-only — injected by Vercel, NOT in `.env.local`, NOT exposed to browser
- [ ] `GET /api/cron/pipeline` is protected by `CRON_SECRET` — NOT by `DEVSCOUT_ADMIN_SECRET`
- [ ] In local development, `CRON_SECRET` check is skipped (no `CRON_SECRET` in env)
- [ ] Missing or invalid admin secret on schedule/process routes returns `401` with JSON error
- [ ] Large integer IDs (`schedule_id`, `run_id`, job `id`) are extracted from raw HTTP response text before `JSON.parse` — never converted to JavaScript number
- [ ] All `lib/scrape/` modules are server-only — never imported in client components
- [ ] `.env.example` documents `CRON_SECRET` without exposing a real value
- [ ] **Security Engineer** must review all credential handling before implementation is considered done

---

## Acceptance Criteria

- [ ] `lib/scrape/oxylabs-scheduler.ts` — Scheduler API client with `createSchedule()`, `listSchedules()`, `getScheduleRuns()`, `getJobResults()`, `deactivateSchedule()`, `getScheduleInfo()` — all with large integer handling
- [ ] `lib/scrape/scheduler.ts` — `syncSchedules()` creates one schedule per active source, cleans up orphans; `processScheduledResults()` fetches completed job HTML and runs pipeline
- [ ] `lib/scrape/pipeline.ts` — `processHomepageContent()` extracted as shared function; `runScrapePipeline()` refactored to use it
- [ ] `POST /api/oxylabs/schedules` — syncs schedules, returns `SyncSchedulesSummary`
- [ ] `GET /api/oxylabs/schedules` — lists stored schedules from DB
- [ ] `POST /api/oxylabs/scheduled-results/process` — processes completed jobs, returns `ProcessResultsSummary`
- [ ] `GET /api/cron/pipeline` — chains sync → process → analysis, protected by `CRON_SECRET`
- [ ] `vercel.json` — cron config at `15 * * * *`
- [ ] `.env.example` — updated with `CRON_SECRET` note
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

---

## Checks to Run

```bash
# 1. TypeScript check
npm run typecheck

# 2. ESLint
npm run lint

# 3. Production build (since routes, config, and server modules changed)
npm run build

# 4. Start dev server for testing
npm run dev
```

---

## Exact Manual Test Steps

After implementation, the implementing specialist shares these exact steps:

### Prerequisites

Ensure `.env.local` has valid `OXY_WSA_USERNAME`, `OXY_WSA_PASSWORD`, and `DEVSCOUT_ADMIN_SECRET`.

### Test 1: Sync Schedules

```bash
# Start dev server in one terminal
npm run dev

# In another terminal, sync schedules
curl -X POST http://localhost:3000/api/oxylabs/schedules \
  -H 'Content-Type: application/json' \
  -H 'x-devscout-admin-secret: YOUR_ADMIN_SECRET'
```

**Watch the dev server terminal** — you should see:
```
🔄 [Scheduler] Syncing schedules with Oxylabs...
  📊 [Scheduler] Found 7 active sources
  ✅ [Scheduler] Created schedule for Hacker News (Oxylabs ID: 4134906379157007223)
  ✅ [Scheduler] Created schedule for GitHub Trending (Oxylabs ID: 2885262175311057587)
  ...
  🔍 [Scheduler] Checking for orphan schedules...
  ✅ [Scheduler] No orphan schedules found
📊 [Scheduler] Sync summary: { "status": "completed", "schedulesCreated": 7, ... }
```

**Expected response:**
```json
{
  "success": true,
  "summary": {
    "status": "completed",
    "sourcesChecked": 7,
    "schedulesCreated": 7,
    "schedulesAlreadyExist": 0,
    "orphansDeactivated": 0,
    "errors": []
  }
}
```

### Test 2: List Schedules

```bash
curl -X GET http://localhost:3000/api/oxylabs/schedules \
  -H 'x-devscout-admin-secret: YOUR_ADMIN_SECRET'
```

**Expected response:**
```json
{
  "success": true,
  "schedules": [
    {
      "id": "uuid-1",
      "oxylabs_schedule_id": "4134906379157007223",
      "source_id": "source-uuid-1",
      "active": true,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

### Test 3: Process Scheduled Results (Manual)

After schedules have had time to run (or if there are existing completed jobs):

```bash
curl -X POST http://localhost:3000/api/oxylabs/scheduled-results/process \
  -H 'Content-Type: application/json' \
  -H 'x-devscout-admin-secret: YOUR_ADMIN_SECRET'
```

**Expected response:**
```json
{
  "success": true,
  "summary": {
    "status": "completed",
    "schedulesProcessed": 7,
    "runsFound": 7,
    "doneJobsFound": 7,
    "jobsFetched": 7,
    "sourcesWithHtml": 7,
    "pipelineSummary": {
      "status": "completed",
      "sourcesChecked": 7,
      "toolsInserted": 3,
      "toolsRejected": 10,
      "toolsFailed": 2,
      ...
    },
    "errors": []
  }
}
```

### Test 4: Cron Pipeline (Manual Trigger)

```bash
# Without CRON_SECRET (local dev — should work)
curl -X GET http://localhost:3000/api/cron/pipeline

# With CRON_SECRET (if set in env)
curl -X GET http://localhost:3000/api/cron/pipeline \
  -H 'x-cron-secret: YOUR_CRON_SECRET'
```

**Expected response:**
```json
{
  "success": true,
  "results": {
    "sync": { "status": "completed" },
    "scrape": { "status": "completed", "toolsInserted": 3 },
    "analysis": { "status": "completed", "analyzed": 3 }
  },
  "totalDurationMs": 45000
}
```

### Test 5: Missing Admin Secret

```bash
curl -X POST http://localhost:3000/api/oxylabs/schedules \
  -H 'Content-Type: application/json'
```

**Expected**: `401` with `{ "success": false, "error": "Missing x-devscout-admin-secret header" }`

### Test 6: Invalid Admin Secret

```bash
curl -X POST http://localhost:3000/api/oxylabs/schedules \
  -H 'Content-Type: application/json' \
  -H 'x-devscout-admin-secret: WRONG_SECRET'
```

**Expected**: `401` with `{ "success": false, "error": "Invalid admin secret" }`

### Test 7: Verify Data in Supabase

After processing, check Supabase Dashboard → Table Editor → `tools` table for newly inserted records. Check `oxylabs_schedules` table for created schedule records. Check `oxylabs_schedule_runs` table for run records.

### Test 8: Verify Logs

```bash
curl -X GET 'http://localhost:3000/api/logs' \
  -H 'x-devscout-admin-secret: YOUR_ADMIN_SECRET' \
  -H 'Content-Type: application/json'
```

**Expected**: Log entries from the scheduler sync, process, and cron pipeline runs.

---

## Handoff Notes

- **Backend Engineer** (primary) implements all modules:
  - `lib/scrape/oxylabs-scheduler.ts` — Scheduler API client
  - `lib/scrape/scheduler.ts` — Scheduler orchestrator
  - `lib/scrape/pipeline.ts` — Refactor to extract `processHomepageContent()`
  - `app/api/oxylabs/schedules/route.ts` — POST + GET
  - `app/api/oxylabs/scheduled-results/process/route.ts` — POST
  - `app/api/cron/pipeline/route.ts` — GET
- **Security Engineer** reviews:
  - Credential handling in `oxylabs-scheduler.ts` (HTTP Basic Auth)
  - `CRON_SECRET` pattern in cron route (not using `DEVSCOUT_ADMIN_SECRET`)
  - Admin secret usage on schedule/process routes
  - Large integer handling (no precision loss)
- **DevOps Engineer** creates `vercel.json` with cron config
- **Code Reviewer** reviews all diffs — check for: server-only imports, no secret exposure, large integer handling correctness, pipeline refactoring completeness
- **QA Engineer** runs `typecheck`, `lint`, `build` and reports exact output; confirms the 8 test steps above
- **Documentation Memory Agent** logs outcome to `docs/agents/memory-log.md`
- **CEO Assistant** compiles final report

## Next Steps After This Prompt

1. Implement all 7 modules in the order listed above
2. Run `npm run typecheck` and `npm run lint` after each module
3. Run `npm run build` after all modules are complete
4. Run the 8 manual test steps
5. Deploy to Vercel (Vercel Cron only works in production)
6. Verify the first automatic cron run in production

---

*Prompt created by Prompt Engineer for Backend Engineer, Security Engineer, DevOps Engineer, Code Reviewer, and QA Engineer implementation*