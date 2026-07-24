# pgvector Support + AI Embedding Generation + Related Tools

## Goal

Enable pgvector in Supabase, upgrade the AI analysis pipeline to generate embeddings alongside tool analysis, add a Postgres function for vector cosine similarity search, and update the tool details page to surface related tools via pgvector instead of the current category-based fallback.

## Assigned Specialist Agents

- **Database Engineer** — pgvector enablement, `embedding vector(1024)` column, IVFFlat index, `match_related_tools` Postgres function, schema.sql update
- **AI/ML Engineer** — embedding generation in analysis pipeline (`lib/analyze/`), use existing NVIDIA provider for embeddings (`snowflake/arctic-embed-l`), `getToolsWithoutEmbeddings` / updated pending detection
- **Frontend Engineer** — add `getRelatedTools()` query function in `lib/supabase/queries/tools.ts`, update tool details page to use pgvector-based related tools
- **Code Reviewer** — review all changes across layers
- **QA Engineer** — run `typecheck`, `lint`, and `build` checks

## Skills Read

- `.agents/skills/supabase/SKILL.md` — Supabase patterns, RLS, `rpc()` for Postgres functions, pgvector via custom function
- `.agents/skills/ai-sdk/SKILL.md` — Vercel AI SDK v7, `embed()` function, provider.embedding() pattern
- `node_modules/ai/docs/03-ai-sdk-core/30-embeddings.mdx` — AI SDK `embed()` API: takes `{ model, value }`, returns `{ embedding: number[] }`

## Existing Code Inspected

### Schema & Types
- `supabase/schema.sql` (lines 302-308) — pgvector section already exists **commented out**:
  ```sql
  -- ALTER TABLE public.tool_analyses ADD COLUMN IF NOT EXISTS embedding vector(1024);
  -- CREATE INDEX IF NOT EXISTS idx_tool_analyses_embedding ON public.tool_analyses USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  ```
- `lib/supabase/types.ts` — `ToolAnalysis.embedding` already typed as `string | null` (line 60), `InsertAnalysisParams.embedding` already typed as `number[] | null | undefined` (line 175)

### Write Queries (Already Handle Embedding)
- `lib/supabase/queries/analyses.ts` — `upsertAnalysis()` already includes `...(params.embedding !== undefined ? { embedding: params.embedding } : {})` (line 228)
- `lib/supabase/queries/analyses.ts` — `insertAnalysis()` already includes `embedding: params.embedding ?? null` (line 115)
- Both validate percentage sums and complexity score before writing

### Read Queries
- `lib/supabase/queries/tools.ts` — `getPendingAnalysisTools()` uses LEFT JOIN approach (fetches analyzed tool IDs, then all tools, filters in JS)
- No `getRelatedTools()` query function exists yet

### Analysis Pipeline
- `lib/analyze/analyze-tool.ts` — creates single NVIDIA provider (`createOpenAI` with `OPENAI_BASE_URL` and `OPENAI_API_KEY`), calls `generateObject` with `nvidiaProvider.chat('minimaxai/minimax-m3')`
- `lib/analyze/index.ts` — `runAnalysisPipeline()` fetches pending tools, batches them, calls `analyzeTool`, saves via `upsertAnalysis()`, then `updateToolAnalyzedAt()`
- No embedding generation exists yet — pipeline saves analysis only

### Frontend
- `app/tools/[id]/page.tsx` (lines 36-44) — fetches related tools via `getTools({ category: tool.tool_analyses.category })` and filters out current tool
- `components/tool-details/related-tools.tsx` — renders `ToolWithAnalysis[]` in horizontal scrollable row with category badge, image, name, summary, score

### Environment
- `.env.example` — has `OPENAI_API_KEY` + `OPENAI_BASE_URL` (used for NVIDIA API). No embedding-specific env vars.

## Decisions & Assumptions

1. **Use existing NVIDIA provider for embeddings**: The same `nvidiaProvider` instance already created in `lib/analyze/analyze-tool.ts` for tool analysis (using `createOpenAI` with `OPENAI_BASE_URL` and `OPENAI_API_KEY`) also supports embeddings via the `/v1/embeddings` endpoint. Use `nvidiaProvider.embedding('snowflake/arctic-embed-l')` for 1024-dimension embeddings. No new env vars needed.

2. **pgvector via `.rpc()`**: supabase-js doesn't support vector operators (`<=>`) in the standard query builder. We create a Postgres function `match_related_tools()` and call it via `supabase.rpc()`.

3. **Backward compatibility**: Tools that already have an analysis row but `embedding IS NULL` must be picked up for backfill. Since pending detection currently relies on tool_analyses row existence (LEFT JOIN), we add a separate `getToolsWithoutEmbeddings()` function to catch these.

4. **Embedding uses tool summary + name**: The text embedded is the tool's analysis summary + name (not the raw scraped text), to keep the vector representation semantic and aligned with the analysis context.

5. **`updateToolAnalyzedAt` must be called AFTER both analysis and embedding**: The current pipeline calls `updateToolAnalyzedAt` right after `upsertAnalysis`. This must be moved to after embedding is saved, or the update must include both. Actually, `upsertAnalysis` already saves everything including embedding. The `analyzed_at` on the `tools` table should be updated only after the embedding is successfully saved.

6. **IVFFlat index with `lists = 100`**: For pgvector, a reasonable default for datasets under 1M rows. The index is created via Supabase Dashboard SQL Editor.

## Files Changed

| File | Change | Owner |
|------|--------|-------|
| `supabase/schema.sql` | Uncomment and finalize pgvector section, add `match_related_tools` function | Database Engineer |
| `lib/analyze/analyze-tool.ts` | Add `generateEmbedding()` function using existing NVIDIA provider (`snowflake/arctic-embed-l`) | AI/ML Engineer |
| `lib/analyze/index.ts` | Update pipeline to generate + save embedding after analysis, add backfill step | AI/ML Engineer |
| `lib/supabase/queries/tools.ts` | Add `getRelatedTools()` and `getToolsWithoutEmbeddings()` | Frontend Engineer / AI/ML Engineer |
| `app/tools/[id]/page.tsx` | Use pgvector-based related tools with category fallback | Frontend Engineer |
| `components/tool-details/related-tools.tsx` | Possibly update if return type differs | Frontend Engineer |

**SQL to run in Supabase Dashboard → SQL Editor** (separate from schema.sql):
1. `CREATE EXTENSION IF NOT EXISTS vector;`
2. Add column + create index
3. Create `match_related_tools` function

---

## Implementation Requirements

### Phase 1: Database Engineer — Schema + Postgres Function

#### 1a. Enable pgvector
Run in Supabase Dashboard → SQL Editor:
```sql
create extension if not exists vector;
```

#### 1b. Add embedding column and index
```sql
alter table public.tool_analyses add column if not exists embedding vector(1024);
create index if not exists idx_tool_analyses_embedding
  on public.tool_analyses
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
```

#### 1c. Create `match_related_tools` Postgres function
```sql
create or replace function public.match_related_tools(
  query_embedding vector(1024),
  match_threshold float default 0.5,
  match_count int default 6
)
returns table (
  id uuid,
  tool_id uuid,
  tool_name text,
  tool_image_url text,
  tool_slug text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    ta.id,
    ta.tool_id,
    t.name as tool_name,
    t.image_url as tool_image_url,
    t.id::text as tool_slug,
    1 - (ta.embedding <=> query_embedding) as similarity
  from public.tool_analyses ta
  join public.tools t on t.id = ta.tool_id
  where ta.embedding is not null
    and 1 - (ta.embedding <=> query_embedding) > match_threshold
  order by ta.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

> **Note on `tool_slug`**: The current app uses UUID `id` as the route param (`/tools/[id]`). The returned `tool_slug` is `t.id::text` for compatibility. If the app later moves to a slug-based URL, this field name can be repurposed.

#### 1d. Update `supabase/schema.sql`
Replace the commented-out pgvector section (lines 302-308) with active SQL:
```sql
-- ============================================================================
-- PGVECTOR
-- ============================================================================
-- Enable pgvector extension (run in Supabase Dashboard → Database → Extensions
-- if not already enabled, or run: create extension if not exists vector)
create extension if not exists vector;

alter table public.tool_analyses add column if not exists embedding vector(1024);
create index if not exists idx_tool_analyses_embedding
  on public.tool_analyses
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ============================================================================
-- VECTOR SIMILARITY SEARCH FUNCTION
-- ============================================================================
create or replace function public.match_related_tools(
  query_embedding vector(1024),
  match_threshold float default 0.5,
  match_count int default 6
)
returns table (
  id uuid,
  tool_id uuid,
  tool_name text,
  tool_image_url text,
  tool_slug text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    ta.id,
    ta.tool_id,
    t.name as tool_name,
    t.image_url as tool_image_url,
    t.id::text as tool_slug,
    1 - (ta.embedding <=> query_embedding) as similarity
  from public.tool_analyses ta
  join public.tools t on t.id = ta.tool_id
  where ta.embedding is not null
    and 1 - (ta.embedding <=> query_embedding) > match_threshold
  order by ta.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

#### 1e. Add TypeScript type for `MatchRelatedToolsResult`
In `lib/supabase/types.ts`, add a return type for the RPC call:
```typescript
export interface MatchRelatedToolsResult {
  id: string;
  tool_id: string;
  tool_name: string;
  tool_image_url: string;
  tool_slug: string;
  similarity: number;
}
```

Also add `Functions` entry to the `Database` type in types.ts to register the RPC function:
```typescript
Functions: {
  match_related_tools: {
    Args: {
      query_embedding: number[];
      match_threshold?: number;
      match_count?: number;
    };
    Returns: MatchRelatedToolsResult[];
  };
  // ...existing functions if any
}
```

#### 1f. Register the function in `lib/supabase/types.ts` `Database.Functions`

---

### Phase 2: AI/ML Engineer — Embedding Generation in Analysis Pipeline

#### 2a. Add `generateEmbedding()` in `lib/analyze/analyze-tool.ts`

The file already imports `nvidiaProvider` (created via `createOpenAI` with `OPENAI_BASE_URL` and `OPENAI_API_KEY`) and uses it for tool analysis. Add the `embed` import and a new exported function that uses `nvidiaProvider.embedding()`:

```typescript
import { embed } from 'ai';

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const { embedding } = await embed({
    model: nvidiaProvider.embedding('snowflake/arctic-embed-l'),
    value: text,
  });

  return embedding;
}
```

No new provider instance or env vars are needed. The existing `nvidiaProvider` already connects to NVIDIA's API which supports `snowflake/arctic-embed-l` via the standard `/v1/embeddings` endpoint without requiring extra `input_type` parameters.

The text to embed should be the **tool name + analysis summary** (concatenated, with a separator). This keeps the embedding semantic and aligned with what the tool is about.

#### 2b. Update `lib/analyze/index.ts`

**Change the pipeline flow** from:
```
1. analyzeTool() → get analysis
2. upsertAnalysis(analysisParams)
3. updateToolAnalyzedAt()
```

To:
```
1. analyzeTool() → get analysis
2. generateEmbedding(toolName + " " + analysis.summary) → get embedding
3. upsertAnalysis({ ...analysisParams, embedding })
4. updateToolAnalyzedAt()  (only after successful embedding + analysis save)
```

**Key changes to `runAnalysisPipeline()`:**

1. After `analyzeTool()` succeeds, call `generateEmbedding()` with the tool name + summary:
   ```typescript
   const embedding = await generateEmbedding(`${tool.name}: ${result.analysis.summary}`);
   ```

2. Include `embedding` in `analysisParams`:
   ```typescript
   const analysisParams: InsertAnalysisParams = {
     // ... all existing fields ...
     embedding: embedding,
   };
   ```

3. Call `updateToolAnalyzedAt()` only after `upsertAnalysis()` succeeds (already the case).

4. If embedding generation fails, the tool should still be marked as analyzed (the analysis was successful; the embedding can be backfilled). Log the error but don't fail the whole tool. Actually — per the acceptance criteria and the description, we should save the analysis even if embedding fails. The tool will be picked up for embedding backfill on the next run because `getToolsWithoutEmbeddings()` will find it.

   **Revised flow**: If analysis succeeds but embedding fails, save analysis without embedding, update analyzed_at, and log the embedding failure. The tool will be backfilled on the next run.

#### 2c. Add `getToolsWithoutEmbeddings()` in `lib/supabase/queries/tools.ts`

This function finds tools that have an analysis row BUT are missing the embedding:
```typescript
export async function getToolsWithoutEmbeddings(limit = 50): Promise<ToolWithAnalysis[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('tool_analyses')
    .select(`
      *,
      tools:tool_id (*)
    `)
    .is('embedding', null)
    .limit(limit)
    .overrideTypes<Array<{ tools: Tool } & ToolAnalysis>, { merge: false }>();

  if (error) {
    console.error('Error fetching tools without embeddings:', error);
    throw new Error(`Failed to fetch tools without embeddings: ${error.message}`);
  }

  return (data || []).map(item => ({
    ...item.tools,
    tool_analyses: {
      ...item,
      tools: undefined,
    } as unknown as ToolAnalysis,
    tool_sources: undefined as unknown as ToolSource,
  })) as ToolWithAnalysis[];
}
```

Wait — actually, the preferred supabase pattern for this is:
1. Query `tool_analyses` where `embedding IS NULL`
2. For each result, fetch the related tool

A cleaner approach: use a two-step query as already established in `getPendingAnalysisTools`:
```typescript
export async function getToolsWithoutEmbeddings(limit = 50): Promise<Tool[]> {
  const supabase = await createServerClient();

  // Step 1: Get tool_ids from tool_analyses where embedding IS NULL
  const { data: incompleteData, error: incompleteError } = await supabase
    .from('tool_analyses')
    .select('tool_id')
    .is('embedding', null);

  if (incompleteError) {
    console.error('Error fetching tool IDs without embeddings:', incompleteError);
    throw new Error(`Failed to fetch tool IDs: ${incompleteError.message}`);
  }

  if (!incompleteData || incompleteData.length === 0) return [];

  const toolIds = incompleteData.map(row => row.tool_id);

  // Step 2: Fetch the actual tools
  const { data: tools, error: toolsError } = await supabase
    .from('tools')
    .select('*')
    .in('id', toolIds)
    .order('analyzed_at', { ascending: true })
    .limit(limit);

  if (toolsError) {
    console.error('Error fetching tools without embeddings:', toolsError);
    throw new Error(`Failed to fetch tools: ${toolsError.message}`);
  }

  return (tools || []) as Tool[];
}
```

#### 2d. Update `runAnalysisPipeline()` to handle backfill

The pipeline should:
1. First run analysis on truly pending tools (no tool_analyses row) — existing behavior
2. Then process tools that have analysis but no embedding (backfill)

The second step only generates embeddings and updates the existing analysis row (via `upsertAnalysis` with the embedding field set, without re-analyzing). It does NOT call `analyzeTool()` again.

Since `upsertAnalysis` uses `onConflict: 'tool_id'`, passing the same analysis data with an embedding will update the existing row.

Add a helper function `backfillEmbeddings()` or extend the pipeline to handle this.

---

### Phase 3: Frontend Engineer — Related Tools Query + UI Update

#### 3a. Add `getRelatedTools()` in `lib/supabase/queries/tools.ts`

```typescript
export interface RelatedTool {
  id: string;
  tool_id: string;
  tool_name: string;
  tool_image_url: string;
  tool_slug: string;
  similarity: number;
}

export async function getRelatedTools(
  toolId: string,
  embedding: number[],
  options: { threshold?: number; count?: number } = {}
): Promise<RelatedTool[]> {
  const supabase = await createServerReadOnlyClient();

  const { threshold = 0.5, count = 6 } = options;

  const { data, error } = await supabase.rpc('match_related_tools', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: count,
  });

  if (error) {
    console.error('Error fetching related tools:', error);
    return [];
  }

  // Filter out the current tool by ID (since the Postgres function may include it)
  return (data || []).filter((tool: RelatedTool) => tool.tool_id !== toolId);
}
```

#### 3b. Update `app/tools/[id]/page.tsx`

Replace the current category-based related tools logic (lines 36-44) with:

```typescript
import { getRelatedTools } from '@/lib/supabase/queries/tools';
import type { RelatedTool } from '@/lib/supabase/queries/tools';

// Inside the page component:
let relatedTools: ToolWithAnalysis[] = [];

// Try pgvector-based related tools first
const analysis = tool.tool_analyses;
if (analysis?.embedding) {
  // Parse the embedding from the stored JSON string to number[]
  const embedding: number[] = JSON.parse(analysis.embedding);
  const related = await getRelatedTools(tool.id, embedding);
  
  if (related.length > 0) {
    // Fetch full ToolWithAnalysis data for each related tool
    // (or map the RelatedTool result to ToolWithAnalysis if needed)
    relatedTools = (await Promise.all(
      related.map(async (r) => {
        const t = await getToolById(r.tool_id);
        return t;
      })
    )).filter((t): t is ToolWithAnalysis => t !== null);
  }
}

// Fallback to category-based if no embedding or no related results
if (relatedTools.length === 0 && analysis?.category) {
  relatedTools = await getTools({
    category: analysis.category,
    analyzedOnly: true,
    limit: 5,
  }) as unknown as ToolWithAnalysis[];
  relatedTools = relatedTools.filter(t => t.id !== id);
}
```

**Important note about embedding parsing**: The `embedding` field in `ToolAnalysis` is typed as `string | null` because supabase-js serializes the vector to a JSON string representation (e.g., `[0.001, 0.002, ...]`). When reading it back from the database, the existing `ToolAnalysis.embedding` type is `string | null`. So we need to `JSON.parse()` it to get the `number[]` for the RPC call.

However, when calling `upsertAnalysis()` with `embedding: number[]`, supabase-js handles the serialization to the vector type on write. The read-back value will be a `string` (JSON-encoded array) because supabase-js returns vector columns as strings.

**Add a helper** to safely parse the embedding:
```typescript
function parseEmbedding(embedding: string | null): number[] | null {
  if (!embedding) return null;
  try {
    return JSON.parse(embedding) as number[];
  } catch {
    return null;
  }
}
```

#### 3c. Update `components/tool-details/related-tools.tsx` if needed

The current `RelatedTools` component accepts `ToolWithAnalysis[]` and works with the data structure returned by `getToolById()`. Since our pgvector path also fetches full tools via `getToolById()`, the component interface doesn't need to change.

If performance becomes an issue (N+1 queries for related tools), we can optimize later by having `match_related_tools` return all needed fields. For now, the simplicity of reusing the existing component is preferred.

---

## Security Requirements

1. No new environment variables are introduced — embedding generation reuses the existing `OPENAI_API_KEY` (already server-only in `lib/analyze/analyze-tool.ts` which imports `'server-only'`).
2. No secret values in client components, API responses, or query strings.
3. The `match_related_tools` Postgres function is `SECURITY INVOKER` (default) — it inherits the caller's permissions. The RLS policies on `tool_analyses` and `tools` already restrict anon reads to analyzed tools only, so related tools results will respect RLS.
4. The `getRelatedTools()` query uses `createServerReadOnlyClient()` (anon key), which is read-only and safe for server components.

## Acceptance Criteria

1. [ ] pgvector extension enabled in Supabase
2. [ ] `embedding vector(1024)` column exists on `tool_analyses` in Supabase
3. [ ] IVFFlat index created on `embedding` column
4. [ ] Postgres function `match_related_tools()` created and tested in Supabase SQL Editor
5. [ ] `supabase/schema.sql` updated with uncommented pgvector section and the function
6. [ ] `lib/supabase/types.ts` updated with `MatchRelatedToolsResult` type and `Functions` registration
7. [ ] `generateEmbedding()` function added to `lib/analyze/analyze-tool.ts` using existing `nvidiaProvider.embedding('snowflake/arctic-embed-l')`
8. [ ] `generateEmbedding()` function works: takes text, returns `number[]` via `snowflake/arctic-embed-l` (1024 dimensions)
9. [ ] Analysis pipeline (`lib/analyze/index.ts`) generates and saves embedding alongside AI analysis
10. [ ] If embedding generation fails, analysis still saves and tool is marked analyzed (backfill later)
11. [ ] `getToolsWithoutEmbeddings()` added to `lib/supabase/queries/tools.ts`
12. [ ] Pipeline backfills embeddings for tools that have analysis but `embedding IS NULL`
13. [ ] `getRelatedTools()` query function in `lib/supabase/queries/tools.ts` calls `match_related_tools` via `.rpc()`
14. [ ] Tool details page at `app/tools/[id]/page.tsx` uses pgvector-based related tools when embedding exists
15. [ ] Falls back to category-based related tools when no embedding or no results
16. [ ] `npm run typecheck` passes ✅
17. [ ] `npm run lint` passes ✅
18. [ ] `npm run build` passes ✅

## Checks to Run

- `npm run typecheck` — TypeScript compilation check
- `npm run lint` — ESLint check
- `npm run build` — Next.js production build (must pass since routes/config changed)
- Verify Supabase SQL commands execute without error in Supabase Dashboard → SQL Editor

## Manual Test Steps

### 1. Enable pgvector + Schema (Database Engineer)
```sql
-- Run these in Supabase Dashboard → SQL Editor in order:
create extension if not exists vector;

alter table public.tool_analyses add column if not exists embedding vector(1024);
create index if not exists idx_tool_analyses_embedding
  on public.tool_analyses
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.match_related_tools(
  query_embedding vector(1024),
  match_threshold float default 0.5,
  match_count int default 6
)
returns table (
  id uuid,
  tool_id uuid,
  tool_name text,
  tool_image_url text,
  tool_slug text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    ta.id,
    ta.tool_id,
    t.name as tool_name,
    t.image_url as tool_image_url,
    t.id::text as tool_slug,
    1 - (ta.embedding <=> query_embedding) as similarity
  from public.tool_analyses ta
  join public.tools t on t.id = ta.tool_id
  where ta.embedding is not null
    and 1 - (ta.embedding <=> query_embedding) > match_threshold
  order by ta.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

### 2. Verify the function works (Database Engineer)
After running analysis and generating embeddings (step 3), test:
```sql
-- Pick a tool that has an embedding and test
select * from match_related_tools(
  (select embedding from tool_analyses limit 1),
  0.5,
  5
);
```

### 3. Test embedding generation (AI/ML Engineer)
No new env vars needed — existing `OPENAI_API_KEY` already works with NVIDIA's API for embeddings.

Run a manual analysis to trigger embedding generation:
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -H "x-devscout-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"limit": 3}'
```

Watch the terminal for logs:
- `🧠 [Embedding] Generating embedding for: ToolName`
- `✅ [Embedding] Generated embedding for ToolName (1024 dimensions)`
- `✅ [Analysis] Analyzed: ToolName (adoption: growing, rating: balanced)`

Verify in Supabase Table Editor that `tool_analyses.embedding` is populated (value is a JSON array string) for newly analyzed tools.

### 4. Verify backfill (AI/ML Engineer)
If there are existing tools with analysis but no embedding, run the pipeline again:
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -H "x-devscout-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"limit": 50}'
```

Verify that tools with existing analysis now get embeddings populated without being re-analyzed.

### 5. Verify related tools on UI (Frontend Engineer)
1. Start the Next.js dev server: `npm run dev`
2. Visit a tool details page: `http://localhost:3000/tools/<some-tool-id>`
3. Scroll to the "Related Tools" section
4. Verify it shows related tools in a horizontal scrollable row
5. Verify the tools are actually related (same category or semantically similar)
6. If a tool has no embedding, verify the fallback category-based related tools appear
7. Click a related tool card — should navigate to that tool's details page

### 6. Regression check (Frontend Engineer)
1. Visit home page: `http://localhost:3000/`
2. Verify tool cards are still displayed correctly
3. Verify search still works
4. Verify the tool details page for a tool without analysis still shows `notFound()`

---

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-23 | Initial prompt — pgvector + embeddings + related tools | Prompt Engineer |
| 2026-07-23 | Updated to use NVIDIA provider for embeddings (`snowflake/arctic-embed-l`, 1024-d) instead of separate OpenAI provider | Prompt Engineer |
