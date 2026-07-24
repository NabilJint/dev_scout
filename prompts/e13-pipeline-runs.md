# Prompt: E13 — pipeline_runs Table

## Goal

Create a dedicated `pipeline_runs` table in Supabase to track pipeline execution state — every manual scrape, scheduler run, cron trigger, and analysis pipeline gets a row. This replaces ad-hoc tracking via the `logs` table and enables pipeline monitoring, retries, and status dashboards.

## Assigned Specialist Agent(s)

- **Database Engineer** (Part A — schema, types, query functions)
- **Backend Engineer** (Part B — integration into pipeline.ts and analyze/index.ts)

## Skills Read

- `supabase` — for schema patterns, table creation, RLS, ALTER TABLE, query functions
- Existing `AGENTS.md` — Sections 7 (existing tables), 9 (pipeline logging), 14 (API routes), 21 (code standards)

## Existing Code Inspected

- `supabase/schema.sql` — existing 6 tables, RLS, index patterns
- `lib/supabase/types.ts` — all existing types, `Database` type, `Json`
- `lib/supabase/queries/runs.ts` — existing `oxylabs_schedule_runs` queries (used as pattern reference)
- `lib/supabase/queries/logs.ts` — existing logging patterns
- `lib/supabase/client.ts` — server client factory
- `lib/scrape/pipeline.ts` — `runScrapePipeline()`, `processHomepageContent()`, `PipelineSummary`
- `lib/analyze/index.ts` — `runAnalysisPipeline()`, `AnalysisSummary`
- `lib/scrape/scheduler.ts` — `syncSchedules()`, `processScheduledResults()`
- `app/api/cron/pipeline/route.ts` — cron handler (GET /api/cron/pipeline)

## Decisions or Assumptions

1. **`pipeline_runs` is a separate table** (not a view over logs). It stores a single row per pipeline run with status, trigger type, summary JSON, and error info.
2. **Primary key is `BIGSERIAL`** (not UUID) since this is a high-volume operational table. Each run also gets a UUID `run_id` for external reference (matching the existing `pipelineRunId` pattern).
3. **`trigger` field** indicates what started the run: `manual` (POST /api/scrape or POST /api/analyze), `cron` (GET /api/cron/pipeline), `scheduler` (POST /api/oxylabs/scheduled-results/process), `analysis` (analysis pipeline).
4. **`status` field** tracks lifecycle: `started` → `discovering` → `enriching` → `analyzing` → `completed`/`failed`.
5. **`summary` JSONB** stores the `PipelineSummary` or `AnalysisSummary` object from each run.
6. **`error` text** captures failure messages for failed runs.
7. **Integration is additive** — existing `logs` table entries and `console.log` calls remain. The pipeline_runs row is created/updated IN ADDITION to existing logging.
8. **The pipeline functions already generate `pipelineRunId` (UUID)** — this becomes the `pipeline_runs.run_id`.
9. **Existing `logs.pipeline_run_id` column** references the same UUID — linking logs to pipeline runs is already in place.

## Part A — Database Engineer

### Files Likely to Change (Part A)

| File | Change |
|------|--------|
| `supabase/schema.sql` | **Modify** — add `CREATE TABLE public.pipeline_runs` |
| `lib/supabase/types.ts` | **Modify** — add `PipelineRun`, `InsertPipelineRunParams`, `UpdatePipelineRunParams`, update `Database` type |
| `lib/supabase/queries/pipeline-runs.ts` | **Create** — CRUD query functions for pipeline_runs |
| `lib/supabase/queries/index.ts` | **Modify** — add barrel export for pipeline-runs |

### Implementation Requirements (Part A)

#### Step A1: Create table in `supabase/schema.sql`

Add after the `oxylabs_schedule_runs` section (after line 287), before the GRANTS section:

```sql
-- ============================================================================
-- TABLE: pipeline_runs
-- ============================================================================
create table if not exists public.pipeline_runs (
    id bigserial primary key,
    run_id uuid not null unique,
    trigger text not null default 'manual' check (trigger in ('manual', 'cron', 'scheduler', 'analysis')),
    status text not null default 'started' check (status in ('started', 'discovering', 'enriching', 'analyzing', 'completed', 'failed')),
    summary jsonb,
    error text,
    started_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz
);

-- Indexes
create index if not exists idx_pipeline_runs_run_id on public.pipeline_runs (run_id);
create index if not exists idx_pipeline_runs_trigger on public.pipeline_runs (trigger);
create index if not exists idx_pipeline_runs_status on public.pipeline_runs (status);
create index if not exists idx_pipeline_runs_started_at on public.pipeline_runs (started_at desc);

-- RLS
alter table public.pipeline_runs enable row level security;

-- Service role only — no anon access
drop policy if exists "pipeline_runs_service_role_all" on public.pipeline_runs;
create policy "pipeline_runs_service_role_all"
    on public.pipeline_runs
    for all
    to service_role
    using (true)
    with check (true);

-- Updated_at trigger
drop trigger if exists update_pipeline_runs_updated_at on public.pipeline_runs;
create trigger update_pipeline_runs_updated_at
    before update on public.pipeline_runs
    for each row
    execute function public.update_updated_at_column();
```

Also add grants after line 306:

```sql
grant all on public.pipeline_runs to service_role;
grant usage, select on sequence public.pipeline_runs_id_seq to service_role;
```

#### Step A2: Add types to `lib/supabase/types.ts`

Add these interfaces before the `Database` type:

```typescript
export interface PipelineRun {
  id: number;
  run_id: string;
  trigger: 'manual' | 'cron' | 'scheduler' | 'analysis';
  status: 'started' | 'discovering' | 'enriching' | 'analyzing' | 'completed' | 'failed';
  summary: Json | null;
  error: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface InsertPipelineRunParams {
  run_id: string;
  trigger: 'manual' | 'cron' | 'scheduler' | 'analysis';
  status?: 'started' | 'discovering' | 'enriching' | 'analyzing' | 'completed' | 'failed';
  summary?: Json | null;
  error?: string | null;
  completed_at?: string | null;
}

export interface UpdatePipelineRunParams {
  status?: 'started' | 'discovering' | 'enriching' | 'analyzing' | 'completed' | 'failed';
  summary?: Json | null;
  error?: string | null;
  completed_at?: string | null;
}
```

Add `pipeline_runs` to the `Database` type's `Tables`:

```typescript
pipeline_runs: {
  Row: PipelineRun;
  Insert: InsertPipelineRunParams;
  Update: UpdatePipelineRunParams;
  Relationships: [];
};
```

#### Step A3: Create `lib/supabase/queries/pipeline-runs.ts`

```typescript
// lib/supabase/queries/pipeline-runs.ts
// Query functions for pipeline_runs table
// Service role only — no anon access

import { createServerClient } from '../client';
import type { PipelineRun, InsertPipelineRunParams, UpdatePipelineRunParams } from '../types';

/**
 * Create a new pipeline run entry.
 */
export async function createPipelineRun(params: InsertPipelineRunParams): Promise<PipelineRun> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('pipeline_runs')
    .insert({
      run_id: params.run_id,
      trigger: params.trigger,
      status: params.status ?? 'started',
      summary: params.summary ?? null,
      error: params.error ?? null,
      completed_at: params.completed_at ?? null,
    })
    .select()
    .single()
    .overrideTypes<PipelineRun, { merge: false }>();

  if (error) {
    console.error('Error creating pipeline run:', error);
    throw new Error(`Failed to create pipeline run: ${error.message}`);
  }

  return data as PipelineRun;
}

/**
 * Update an existing pipeline run by run_id.
 */
export async function updatePipelineRun(
  runId: string,
  params: UpdatePipelineRunParams
): Promise<PipelineRun> {
  const supabase = await createServerClient();

  const updates: Record<string, unknown> = {};
  if (params.status !== undefined) updates.status = params.status;
  if (params.summary !== undefined) updates.summary = params.summary;
  if (params.error !== undefined) updates.error = params.error;
  if (params.completed_at !== undefined) updates.completed_at = params.completed_at;

  const { data, error } = await supabase
    .from('pipeline_runs')
    .update(updates)
    .eq('run_id', runId)
    .select()
    .single()
    .overrideTypes<PipelineRun, { merge: false }>();

  if (error) {
    console.error('Error updating pipeline run:', error);
    throw new Error(`Failed to update pipeline run: ${error.message}`);
  }

  return data as PipelineRun;
}

/**
 * Mark a pipeline run as completed with its summary.
 */
export async function completePipelineRun(
  runId: string,
  summary: Record<string, unknown>
): Promise<PipelineRun> {
  return updatePipelineRun(runId, {
    status: 'completed',
    summary: summary as unknown as Json,
    completed_at: new Date().toISOString(),
  });
}

/**
 * Mark a pipeline run as failed with an error message.
 */
export async function failPipelineRun(
  runId: string,
  error: string,
  summary?: Record<string, unknown> | null
): Promise<PipelineRun> {
  return updatePipelineRun(runId, {
    status: 'failed',
    summary: (summary ?? null) as unknown as Json | null,
    error,
    completed_at: new Date().toISOString(),
  });
}

/**
 * Get a pipeline run by run_id.
 */
export async function getPipelineRun(runId: string): Promise<PipelineRun | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('run_id', runId)
    .single()
    .overrideTypes<PipelineRun, { merge: false }>();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching pipeline run:', error);
    throw new Error(`Failed to fetch pipeline run: ${error.message}`);
  }

  return data as PipelineRun;
}

/**
 * List pipeline runs with pagination.
 */
export async function listPipelineRuns(
  options: {
    limit?: number;
    offset?: number;
    trigger?: 'manual' | 'cron' | 'scheduler' | 'analysis';
    status?: string;
  } = {}
): Promise<PipelineRun[]> {
  const supabase = await createServerClient();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  let query = supabase
    .from('pipeline_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.trigger) {
    query = query.eq('trigger', options.trigger);
  }

  if (options.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query.overrideTypes<PipelineRun[], { merge: false }>();

  if (error) {
    console.error('Error listing pipeline runs:', error);
    throw new Error(`Failed to list pipeline runs: ${error.message}`);
  }

  return (data as PipelineRun[]) || [];
}
```

#### Step A4: Export from `lib/supabase/queries/index.ts`

Add:

```typescript
export * from './pipeline-runs';
```

## Part B — Backend Engineer

### Files Likely to Change (Part B)

| File | Change |
|------|--------|
| `lib/scrape/pipeline.ts` | **Modify** — create pipeline run at start, update at end |
| `lib/analyze/index.ts` | **Modify** — create pipeline run at start, update at end |

### Implementation Requirements (Part B)

#### Step B1: Integrate into `lib/scrape/pipeline.ts`

Update `runScrapePipeline()` to create and update pipeline_runs:

1. **Add imports** at top:
   ```typescript
   import { createPipelineRun, completePipelineRun, failPipelineRun } from '@/lib/supabase/queries/pipeline-runs';
   ```

2. **After generating `pipelineRunId`** (line 237), create a pipeline run entry:
   ```typescript
   // Create pipeline run tracking entry
   try {
     await createPipelineRun({
       run_id: pipelineRunId,
       trigger: 'manual', // Manual scrape — caller can override if needed
       status: 'started',
     });
     console.log(`📊 [Pipeline] Pipeline run created: ${pipelineRunId}`);
   } catch (err) {
     console.warn(`  ⚠️  [Pipeline] Failed to create pipeline run entry: ${err}`);
     // Non-fatal — pipeline still runs
   }
   ```

3. **Before the final return** (after line 332), update the pipeline run with the summary:
   ```typescript
   try {
     if (summary.status === 'failed' || summary.status === 'partial') {
       await failPipelineRun(pipelineRunId, 'One or more sources failed', summary as unknown as Record<string, unknown>);
     } else {
       await completePipelineRun(pipelineRunId, summary as unknown as Record<string, unknown>);
     }
   } catch (err) {
     console.warn(`  ⚠️  [Pipeline] Failed to update pipeline run: ${err}`);
   }
   ```

4. **Also integrate into `processHomepageContent()`** — if called independently (not via `runScrapePipeline`), the caller is responsible for creating the pipeline run. Add a `pipelineRunId` parameter check:
   ```typescript
   // At the end of processHomepageContent, if pipelineRunId was provided:
   if (pipelineRunId) {
     try {
       const summaryObj = { /* the pipeline summary */ };
       await completePipelineRun(pipelineRunId, summaryObj);
     } catch { /* non-fatal */ }
   }
   ```

   However, since `processHomepageContent()` already returns a `PipelineSummary`, the caller should own the pipeline run lifecycle. Only integrate in `runScrapePipeline()` and leave `processHomepageContent()` unchanged.

#### Step B2: Integrate into `lib/analyze/index.ts`

Update `runAnalysisPipeline()` to create and update pipeline_runs:

1. **Add imports** at top:
   ```typescript
   import { createPipelineRun, completePipelineRun, failPipelineRun } from '@/lib/supabase/queries/pipeline-runs';
   ```

2. **After generating or receiving `pipelineRunId`** (line 73), create a pipeline run entry:
   ```typescript
   // Create pipeline run tracking entry
   try {
     await createPipelineRun({
       run_id: pipelineRunId,
       trigger: 'analysis',
       status: 'started',
     });
     console.log(`📊 [Analysis] Pipeline run created: ${pipelineRunId}`);
   } catch (err) {
     console.warn(`  ⚠️  [Analysis] Failed to create pipeline run entry: ${err}`);
     // Non-fatal
   }
   ```

3. **Before returning** (after line 247), update the pipeline run with the analysis summary:
   ```typescript
   try {
     if (status === 'failed') {
       await failPipelineRun(pipelineRunId, 'Analysis pipeline failed', { summary } as unknown as Record<string, unknown>);
     } else {
       await completePipelineRun(pipelineRunId, { status, checked: total, analyzed, skipped, failed, totalDuration } as unknown as Record<string, unknown>);
     }
   } catch (err) {
     console.warn(`  ⚠️  [Analysis] Failed to update pipeline run: ${err}`);
   }
   ```

### No changes needed to:

- `lib/scrape/scheduler.ts` — `processScheduledResults()` already delegates to `processHomepageContent()` which is handled by `runScrapePipeline()` or its caller. The scheduler's own pipeline run will be added in a future pass.
- `app/api/cron/pipeline/route.ts` — the cron handler calls the pipeline functions, which now handle their own pipeline run lifecycle.
- Existing `logs` queries — all existing logging remains unchanged.

## Security Requirements

- `pipeline_runs` table has service-role-only RLS (no anon access)
- No env vars changed
- No client-side exposure of pipeline run data

## Acceptance Criteria

### Part A
1. `pipeline_runs` table created in `supabase/schema.sql` with correct schema, indexes, RLS, trigger
2. `PipelineRun`, `InsertPipelineRunParams`, `UpdatePipelineRunParams` types added to `lib/supabase/types.ts`
3. `pipeline_runs` entry in `Database` type's `Tables`
4. `lib/supabase/queries/pipeline-runs.ts` with `createPipelineRun()`, `updatePipelineRun()`, `completePipelineRun()`, `failPipelineRun()`, `getPipelineRun()`, `listPipelineRuns()`
5. Module exported from `lib/supabase/queries/index.ts`
6. GRANT statements added for `pipeline_runs` + its sequence

### Part B
7. `lib/scrape/pipeline.ts` creates pipeline run at start, completes/fails at end in `runScrapePipeline()`
8. `lib/analyze/index.ts` creates pipeline run at start, completes/fails at end in `runAnalysisPipeline()`
9. Pipeline run creation is non-fatal — pipeline continues if run tracking fails
10. Existing `PipelineSummary` and `AnalysisSummary` types unchanged
11. `npm run typecheck` passes with zero errors
12. `npm run lint` passes with zero new errors
13. `npm run build` passes

## Checks to Run

- `npm run typecheck` — TypeScript, no emit
- `npm run lint` — ESLint
- `npm run build` — Next.js production build

## Exact Manual Test Steps

1. **Run the SQL** in Supabase Dashboard → SQL Editor:
   ```sql
   -- Run the pipeline_runs table creation SQL from supabase/schema.sql
   ```

2. **Trigger a manual scrape**:
   ```bash
   curl -X POST http://localhost:3000/api/scrape \
     -H "Content-Type: application/json" \
     -H "x-devscout-admin-secret: YOUR_ADMIN_SECRET" \
     -d '{"sourceNames": ["producthunt"], "perSourceLimit": 1}'
   ```

3. **Watch console** for:
   - `[Pipeline] Pipeline run created: <uuid>`
   - `[Pipeline] Pipeline summary: { ... }`
   - `[Pipeline] Pipeline run completed` (implied — no error)

4. **Verify in Supabase**:
   ```sql
   SELECT * FROM public.pipeline_runs ORDER BY started_at DESC LIMIT 5;
   ```
   Should show a row with `trigger = 'manual'`, `status = 'completed'`, `summary` with the pipeline summary data.

5. **Trigger AI analysis**:
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "Content-Type: application/json" \
     -H "x-devscout-admin-secret: YOUR_ADMIN_SECRET" \
     -d '{"limit": 1}'
   ```

6. **Verify** the new pipeline_runs row shows `trigger = 'analysis'` and `status = 'completed'`.

7. Run `npm run typecheck && npm run lint && npm run build` — all must pass.
