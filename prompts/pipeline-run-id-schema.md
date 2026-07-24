# Prompt: pipeline_run_id on Logs Table

## Goal

Add a `pipeline_run_id` column to the `logs` table so every log entry can be correlated back to a specific pipeline run. Pipeline runs (manual scrape, scheduled process, cron pipeline, analysis pipeline) generate a UUID at start time, attach it to every log emitted during that run, and the final summary log includes the run ID. This enables filtering logs by run, debugging multi-step failures, and building a run-centric log viewer later.

## Assigned Specialist Agent(s)

- **Database Engineer** (schema change, types update, query functions update)
- **Backend Engineer** (pipeline entry points — generate UUID, pass to log calls)
- **Code Reviewer** (review diff)
- **QA Engineer** (run checks)

## Skills Read

- `supabase` — Supabase schema patterns, ALTER TABLE, types
- Existing `AGENTS.md` — Sections 7, 9, 14, 15, 21

## Existing Code Inspected

- `supabase/schema.sql` — Logs table definition (line 192-198)
- `lib/supabase/types.ts` — `Log`, `InsertLogParams` interfaces (lines 64-130)
- `lib/supabase/queries/logs.ts` — `insertLog`, `insertLogs`, `logInfo`, `logWarn`, `logError` (lines 82-138)
- `lib/scrape/pipeline.ts` — `runScrapePipeline`, `processHomepageContent` entry points
- `lib/scrape/scheduler.ts` — `syncSchedules`, `processScheduledResults` entry points
- `lib/analyze/index.ts` — `runAnalysisPipeline` entry point
- `app/api/cron/pipeline/route.ts` — Cron pipeline entry point

## Decisions or Assumptions

1. **Run IDs are UUIDs generated application-side** at the start of each pipeline entry point, not database-generated. This lets us attach the ID before any DB call.
2. **pipeline_run_id is nullable** on the `logs` table — existing logs without a run ID retain backward compatibility.
3. **Not all log calls need a run ID** — convenience functions (`logInfo`, `logWarn`, `logError`) keep their existing signatures. A new function signature accepts run ID.
4. **The UUID is generated once** per top-level pipeline invocation and threaded through to all log calls within that invocation. It is **not** generated per log entry.
5. **Run ID is optional** in `InsertLogParams` — set to `null` when not in a pipeline context. This preserves all existing callers.
6. **A separate `pipeline_runs` table is NOT built in this task** — the Database Engineer's evaluation (see memory-log 2026-07-24) recommended deferring that. This task only adds the column to `logs`.
7. **No index on `pipeline_run_id` initially** — only needed when filtering by it becomes a performance requirement. Can be added later.

## Files Likely to Change

| File | Change |
|------|--------|
| `supabase/schema.sql` | ALTER TABLE logs ADD COLUMN pipeline_run_id UUID |
| `lib/supabase/types.ts` | Add `pipeline_run_id` to `Log` interface, add `pipelineRunId?` to `InsertLogParams` |
| `lib/supabase/queries/logs.ts` | Update `insertLog`, `insertLogs` to accept and store `pipeline_run_id` |
| `lib/scrape/pipeline.ts` | Generate UUID at start, pass to logInfo/logError calls throughout |
| `lib/scrape/scheduler.ts` | Generate UUID at start of `syncSchedules` and `processScheduledResults` |
| `lib/analyze/index.ts` | Generate UUID at start of `runAnalysisPipeline` |
| `app/api/cron/pipeline/route.ts` | Generate UUID at start of cron handler |

## Implementation Requirements

### Step 1: ALTER TABLE SQL

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Add pipeline_run_id column to logs table (nullable, backward-compatible)
alter table public.logs add column if not exists pipeline_run_id uuid;

-- Index for filtering logs by run (optional but helpful for debugging)
create index if not exists idx_logs_pipeline_run_id on public.logs (pipeline_run_id);
```

Also add to `supabase/schema.sql` in the logs table section (after `metadata jsonb,`):

```sql
    pipeline_run_id uuid,
```

And add the index after the existing log indexes:

```sql
create index if not exists idx_logs_pipeline_run_id on public.logs (pipeline_run_id);
```

### Step 2: Update TypeScript types in `lib/supabase/types.ts`

Update the `Log` interface:

```typescript
export interface Log {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata: Json | null;
  pipeline_run_id: string | null;  // NEW — nullable, backward-compatible
  created_at: string;
}
```

Update `InsertLogParams`:

```typescript
export interface InsertLogParams {
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Json | null;
  pipeline_run_id?: string | null;  // NEW — optional, defaults to null
}
```

Update the `Database` type's `logs` table definition:

```typescript
logs: {
  Row: Log;  // Log already has pipeline_run_id now
  Insert: Omit<Log, 'id' | 'created_at'>;  // includes optional pipeline_run_id
  Update: Partial<Omit<Log, 'id' | 'created_at'>>;
  Relationships: [];
};
```

### Step 3: Update Query Functions in `lib/supabase/queries/logs.ts`

Update `insertLog`:

```typescript
export async function insertLog(params: InsertLogParams): Promise<Log> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('logs')
    .insert({
      level: params.level,
      message: params.message,
      metadata: params.metadata ?? null,
      pipeline_run_id: params.pipeline_run_id ?? null,  // NEW
    })
    .select()
    .single()
    .overrideTypes<Log, { merge: false }>();

  if (error) {
    console.error('Error inserting log:', error);
    throw new Error(`Failed to insert log: ${error.message}`);
  }

  return data as Log;
}
```

Update `insertLogs` (bulk insert):

```typescript
export async function insertLogs(logs: InsertLogParams[]): Promise<Log[]> {
  if (logs.length === 0) return [];

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('logs')
    .insert(logs.map(l => ({
      level: l.level,
      message: l.message,
      metadata: l.metadata ?? null,
      pipeline_run_id: l.pipeline_run_id ?? null,  // NEW
    })))
    .select()
    .overrideTypes<Log[], { merge: false }>();

  if (error) {
    console.error('Error inserting logs:', error);
    throw new Error(`Failed to insert logs: ${error.message}`);
  }

  return (data as Log[]) || [];
}
```

**Update convenience functions** to accept optional `pipelineRunId`:

```typescript
export async function logInfo(
  message: string,
  metadata?: Json,
  pipelineRunId?: string  // NEW — optional
): Promise<Log> {
  return insertLog({ level: 'info', message, metadata, pipeline_run_id: pipelineRunId });
}

export async function logWarn(
  message: string,
  metadata?: Json,
  pipelineRunId?: string  // NEW — optional
): Promise<Log> {
  return insertLog({ level: 'warn', message, metadata, pipeline_run_id: pipelineRunId });
}

export async function logError(
  message: string,
  metadata?: Json,
  pipelineRunId?: string  // NEW — optional
): Promise<Log> {
  return insertLog({ level: 'error', message, metadata, pipeline_run_id: pipelineRunId });
}
```

### Step 4: Integrate into Pipeline Entry Points

Each pipeline entry point should:

1. Import `crypto` from `'crypto'` (Node.js built-in) or use `crypto.randomUUID()`.
2. Generate a UUID at the very start of the function.
3. Pass the `pipelineRunId` to every `logInfo`, `logWarn`, `logError` call within that function.
4. Include `pipelineRunId` in the final summary log.

**`lib/scrape/pipeline.ts` — `runScrapePipeline`:**

```typescript
import crypto from 'crypto';

export async function runScrapePipeline(
  sources: ToolSource[],
  options?: { perSourceLimit?: number }
): Promise<PipelineSummary> {
  const pipelineRunId = crypto.randomUUID();
  // ... existing code ...

  // Update all logInfo/logError calls to pass pipelineRunId:
  await logError(`Scrape error for ${source.name}`, {
    source: source.name,
    listingUrl: source.listing_url,
    error: homepageResult.error,
  }, pipelineRunId);

  // Final summary log:
  await logInfo('Scrape pipeline completed', {
    summary: summary as unknown as Json,
    sourceCount: sources.length,
    sourceNames: sources.map(s => s.name),
    pipelineRunId,  // include run ID in metadata too
  } as Record<string, Json>, pipelineRunId);
}
```

**`lib/scrape/pipeline.ts` — `processHomepageContent`:**

Since `processHomepageContent` is called by both `runScrapePipeline` and `processScheduledResults`, it should accept an optional `pipelineRunId` parameter:

```typescript
export async function processHomepageContent(
  sourcesWithHtml: Array<{ source: ToolSource; html: string }>,
  options?: { perSourceLimit?: number; pipelineRunId?: string }
): Promise<PipelineSummary> {
  const pipelineRunId = options?.pipelineRunId;
  // ... update all internal logInfo/logError/logWarn calls with pipelineRunId
}
```

**`lib/scrape/scheduler.ts` — `syncSchedules`:**

```typescript
export async function syncSchedules(): Promise<SyncSchedulesSummary> {
  const pipelineRunId = crypto.randomUUID();
  // ... update console.warn → logWarn calls with pipelineRunId
  await logInfo('Scheduler sync completed', { summary } as unknown as Json, pipelineRunId);
}
```

**`lib/scrape/scheduler.ts` — `processScheduledResults`:**

```typescript
export async function processScheduledResults(): Promise<ProcessResultsSummary> {
  const pipelineRunId = crypto.randomUUID();
  // ... pass pipelineRunId to processHomepageContent in the options:
  pipelineSummary = await processHomepageContent(resolvedSourcesWithHtml, { pipelineRunId });
  // ... update all logInfo/logError calls
  await logInfo('Scheduler process completed', { summary } as unknown as Json, pipelineRunId);
}
```

**`lib/analyze/index.ts` — `runAnalysisPipeline`:**

```typescript
export async function runAnalysisPipeline(
  options: { limit?: number; toolIds?: string[]; pipelineRunId?: string } = {}
): Promise<AnalysisSummary> {
  const pipelineRunId = options.pipelineRunId ?? crypto.randomUUID();
  // ... update all logInfo/logError calls with pipelineRunId
  await logInfo('Analysis pipeline completed', {
    summary: { status, checked: total, analyzed, skipped, failed, totalDuration },
  }, pipelineRunId);
}
```

**`app/api/cron/pipeline/route.ts`:**

```typescript
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const pipelineRunId = crypto.randomUUID();
  // ... pass pipelineRunId to syncSchedules, processScheduledResults, runAnalysisPipeline
  // ... pass pipelineRunId to PostHog events too
}
```

### Step 5: Update callers of `processHomepageContent`

In `lib/scrape/pipeline.ts`, the call from `runScrapePipeline`:

```typescript
const summary = await processHomepageContent(sourcesWithHtml, {
  perSourceLimit: limit,
  pipelineRunId,
});
```

In `lib/scrape/scheduler.ts`, the call from `processScheduledResults`:

```typescript
pipelineSummary = await processHomepageContent(resolvedSourcesWithHtml, {
  pipelineRunId,
});
```

## Security Requirements

- `crypto.randomUUID()` is a Node.js built-in, server-only by default — safe.
- `pipelineRunId` is never exposed to browser code.
- The `logs` table remains service-role only (no anon access, per schema.sql RLS policy).
- No changes to admin secret or cron secret patterns.

## Acceptance Criteria

1. ALTER TABLE SQL runs cleanly and adds `pipeline_run_id` column to `logs`.
2. New column is nullable (existing rows have `NULL`).
3. TypeScript types updated: `Log.pipeline_run_id`, `InsertLogParams.pipeline_run_id`.
4. `insertLog` and `insertLogs` persist the new column.
5. `logInfo`, `logWarn`, `logError` accept optional third `pipelineRunId` parameter.
6. `runScrapePipeline` generates a UUID and passes it to all log calls.
7. `processHomepageContent` accepts optional `pipelineRunId` and passes it to log calls.
8. `syncSchedules` generates a UUID and passes it to log calls.
9. `processScheduledResults` generates a UUID and passes it to log calls.
10. `runAnalysisPipeline` generates a UUID (or accepts one) and passes it to log calls.
11. `cron/pipeline/route.ts` generates a UUID and passes it through the chain.
12. All existing callers continue to work unchanged (optional parameter).
13. `npm run typecheck` passes with zero errors.
14. `npm run lint` passes with zero new errors.

## Checks to Run

- `npm run typecheck` — TypeScript no-emit
- `npm run lint` — ESLint
- `npm run build` — Next.js production build

## Exact Manual Test Steps

1. Run the ALTER TABLE SQL in Supabase Dashboard → SQL Editor.
2. Verify the column was added: `SELECT pipeline_run_id FROM public.logs LIMIT 1;`
3. Run `npm run dev`.
4. Trigger a manual scrape: `curl -X POST http://localhost:3000/api/scrape -H "x-devscout-admin-secret: YOUR_SECRET" -H "Content-Type: application/json" -d '{"sourceIds": ["<a-source-uuid>"], "perSourceLimit": 1}'`
5. Check the logs table in Supabase: `SELECT pipeline_run_id, message FROM public.logs WHERE pipeline_run_id IS NOT NULL ORDER BY created_at DESC LIMIT 10;`
6. Verify all log entries for the scrape share the same `pipeline_run_id`.
7. Trigger analysis: `curl -X POST http://localhost:3000/api/analyze -H "x-devscout-admin-secret: YOUR_SECRET" -H "Content-Type: application/json" -d '{"limit": 2}'`
8. Verify analysis logs have a `pipeline_run_id` (different UUID from the scrape run).
9. Check the logs API endpoint returns pipeline_run_id: `curl http://localhost:3000/api/logs -H "x-devscout-admin-secret: YOUR_SECRET"`
