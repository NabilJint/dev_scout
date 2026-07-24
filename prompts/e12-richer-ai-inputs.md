# Prompt: E12 — Richer AI Inputs + research_documents Table

## Goal

Three-part ticket to improve AI analysis inputs:

**Part A (Database Engineer):** Create `research_documents` table in Supabase — stores markdown versions of homepage, docs, pricing, and GitHub README for each tool.

**Part B (Backend Engineer + AI/ML Engineer):** Create `lib/analyze/research-doc.ts` — fetches homepage, /docs, /pricing, and GitHub README content per tool, combines into structured markdown, stores in `research_documents`.

**Part C (Backend Engineer):** Update the AI analysis pipeline to use research documents instead of raw `raw_text` alone as the primary analysis input. Fall back to raw_text when research documents are unavailable.

## Assigned Specialist Agent(s)

- **Database Engineer** (Part A — schema, types, query functions)
- **Backend Engineer** (Part B — research doc builder + Part C — analysis prompt update)
- **AI/ML Engineer** (Part B — assist with research doc builder design + Part C — analysis prompt update)
- **Code Reviewer** (review diff)
- **QA Engineer** (run checks)

## Skills Read

- `supabase` — for schema patterns, table creation, RLS, query functions
- `ai-sdk` — for understanding existing analysis patterns (prompt.ts, schema.ts)
- Existing `AGENTS.md` — Sections 7 (tool tables), 19 (AI analysis), 21 (security, code standards)

## Existing Code Inspected

- `supabase/schema.sql` — existing table definitions, RLS patterns, index patterns
- `lib/supabase/types.ts` — `Database` type, `Tool`, `ToolAnalysis`, all query param types
- `lib/supabase/queries/tools.ts` — `getTools`, `getPendingAnalysisTools`
- `lib/supabase/queries/analyses.ts` — `upsertAnalysis`, `getAnalysisByToolId`
- `lib/supabase/client.ts` — server/client patterns
- `lib/analyze/prompt.ts` — `ANALYSIS_SYSTEM_PROMPT` and `buildAnalysisPrompt()`
- `lib/analyze/analyze-tool.ts` — `analyzeTool()` — takes `rawText` as parameter
- `lib/analyze/index.ts` — `runAnalysisPipeline()` — passes `tool.raw_text` to `analyzeTool()`
- `lib/analyze/schema.ts` — `AnalysisSchema`, `AnalysisOutput`
- `lib/enrichment/resolve-website.ts` — fetch patterns (used as reference for parallel doc fetching)
- `lib/scrape/pipeline.ts` — enrichment flow reference

## Decisions or Assumptions

1. **`research_documents` table uses `BIGSERIAL` primary key** (not UUID) since this is a high-volume table. This matches the user's spec.
2. **The table has a UNIQUE constraint on `tool_id`** — one research document per tool.
3. **Content hash is used for deduplication** — if the same content is scraped twice, the hash comparison skips re-storing.
4. **Research documents are markdown** — each URL's content is converted to markdown before storage. Jina Reader is used for markdown conversion since it already returns markdown.
5. **Parallel fetches with individual 10s timeouts** — homepage, /docs, /pricing, and GitHub README are fetched concurrently.
6. **`buildResearchDoc()` is imported by the analysis pipeline** — it's called before analysis, not during enrichment.
7. **The analysis prompt is updated** to use the research document markdown (which includes all sources) instead of `raw_text` alone. If the research doc is unavailable, fall back to `raw_text`.
8. **The analysis output schema is unchanged** — only the input changes.
9. **Existing `analyzeTool()` signature changes** — accepts an additional optional `researchDoc` parameter.

## Part A — Database Engineer

### Files Likely to Change (Part A)

| File | Change |
|------|--------|
| `supabase/schema.sql` | **Modify** — add `CREATE TABLE public.research_documents` |
| `lib/supabase/types.ts` | **Modify** — add `ResearchDocument`, `InsertResearchDocumentParams`, update `Database` type |
| `lib/supabase/queries/research-documents.ts` | **Create** — `getResearchDocByToolId()`, `upsertResearchDoc()`, `deleteResearchDocByToolId()` |

### Implementation Requirements (Part A)

#### Step A1: Create table in `supabase/schema.sql`

Add after the `tool_analyses` section (after line 197), before the `logs` section:

```sql
-- ============================================================================
-- TABLE: research_documents
-- ============================================================================
create table if not exists public.research_documents (
    id bigserial primary key,
    tool_id uuid not null unique references public.tools(id) on delete cascade,
    homepage_md text,
    docs_md text,
    pricing_md text,
    github_readme_md text,
    metadata jsonb,
    content_hash text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_research_documents_tool_id on public.research_documents (tool_id);
create index if not exists idx_research_documents_created_at on public.research_documents (created_at desc);

-- RLS
alter table public.research_documents enable row level security;

-- Service role only — no anon access
drop policy if exists "research_documents_service_role_all" on public.research_documents;
create policy "research_documents_service_role_all"
    on public.research_documents
    for all
    to service_role
    using (true)
    with check (true);

-- Updated_at trigger
drop trigger if exists update_research_documents_updated_at on public.research_documents;
create trigger update_research_documents_updated_at
    before update on public.research_documents
    for each row
    execute function public.update_updated_at_column();
```

Also add grants:

```sql
grant all on public.research_documents to service_role;
grant usage, select on sequence public.research_documents_id_seq to service_role;
```

#### Step A2: Add types to `lib/supabase/types.ts`

Add these interfaces before the `Database` type:

```typescript
export interface ResearchDocument {
  id: number;
  tool_id: string;
  homepage_md: string | null;
  docs_md: string | null;
  pricing_md: string | null;
  github_readme_md: string | null;
  metadata: Json | null;
  content_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface InsertResearchDocumentParams {
  tool_id: string;
  homepage_md?: string | null;
  docs_md?: string | null;
  pricing_md?: string | null;
  github_readme_md?: string | null;
  metadata?: Json | null;
  content_hash?: string | null;
}

export interface UpdateResearchDocumentParams {
  homepage_md?: string | null;
  docs_md?: string | null;
  pricing_md?: string | null;
  github_readme_md?: string | null;
  metadata?: Json | null;
  content_hash?: string | null;
}
```

Add `research_documents` to the `Database` type's `Tables` (after `oxylabs_schedule_runs`):

```typescript
research_documents: {
  Row: ResearchDocument;
  Insert: InsertResearchDocumentParams;
  Update: UpdateResearchDocumentParams;
  Relationships: [
    {
      foreignKeyName: "research_documents_tool_id_fkey";
      columns: ["tool_id"];
      isOneToOne: true;
      referencedRelation: "tools";
      referencedColumns: ["id"];
    }
  ];
};
```

#### Step A3: Create `lib/supabase/queries/research-documents.ts`

```typescript
// lib/supabase/queries/research-documents.ts
// Query functions for research_documents table
// Service role only — no anon access

import { createServerClient } from '../client';
import type { ResearchDocument, InsertResearchDocumentParams, UpdateResearchDocumentParams } from '../types';

export async function getResearchDocByToolId(toolId: string): Promise<ResearchDocument | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('research_documents')
    .select('*')
    .eq('tool_id', toolId)
    .single()
    .overrideTypes<ResearchDocument, { merge: false }>();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching research document:', error);
    throw new Error(`Failed to fetch research document: ${error.message}`);
  }

  return data as ResearchDocument;
}

export async function upsertResearchDoc(params: InsertResearchDocumentParams): Promise<ResearchDocument> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('research_documents')
    .upsert({
      tool_id: params.tool_id,
      homepage_md: params.homepage_md ?? null,
      docs_md: params.docs_md ?? null,
      pricing_md: params.pricing_md ?? null,
      github_readme_md: params.github_readme_md ?? null,
      metadata: params.metadata ?? null,
      content_hash: params.content_hash ?? null,
    }, {
      onConflict: 'tool_id',
    })
    .select()
    .single()
    .overrideTypes<ResearchDocument, { merge: false }>();

  if (error) {
    console.error('Error upserting research document:', error);
    throw new Error(`Failed to upsert research document: ${error.message}`);
  }

  return data as ResearchDocument;
}

export async function updateResearchDoc(
  toolId: string,
  updates: UpdateResearchDocumentParams
): Promise<ResearchDocument> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('research_documents')
    .update(updates)
    .eq('tool_id', toolId)
    .select()
    .single()
    .overrideTypes<ResearchDocument, { merge: false }>();

  if (error) {
    console.error('Error updating research document:', error);
    throw new Error(`Failed to update research document: ${error.message}`);
  }

  return data as ResearchDocument;
}

export async function deleteResearchDocByToolId(toolId: string): Promise<void> {
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('research_documents')
    .delete()
    .eq('tool_id', toolId);

  if (error) {
    console.error('Error deleting research document:', error);
    throw new Error(`Failed to delete research document: ${error.message}`);
  }
}
```

#### Step A4: Export from `lib/supabase/queries/index.ts`

Add to the barrel export:

```typescript
export * from './research-documents';
```

## Part B — Backend Engineer + AI/ML Engineer

### Files Likely to Change (Part B)

| File | Change |
|------|--------|
| `lib/analyze/research-doc.ts` | **Create** — `buildResearchDoc()`, URL construction helpers |
| `lib/analyze/index.ts` | **Modify** — call `buildResearchDoc()` before analysis |

### Implementation Requirements (Part B)

#### Step B1: Create `lib/analyze/research-doc.ts`

```typescript
import 'server-only';
import crypto from 'crypto';

// lib/analyze/research-doc.ts
// Research document builder.
// Fetches homepage, /docs, /pricing, and GitHub README for a tool,
// combines them into structured markdown, and stores in research_documents.

import { resolveWebsite } from '@/lib/enrichment/resolve-website';
import { fetchViaJina } from '@/lib/enrichment/jina-fallback';
import { upsertResearchDoc } from '@/lib/supabase/queries/research-documents';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Default sub-pages to attempt for each tool website.
 * The builder tries each path and keeps what succeeds.
 */
const DEFAULT_SUB_PATHS: Record<string, string> = {
  docs: '/docs',
  pricing: '/pricing',
};

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Build a sub-page URL from a base website URL.
 */
function buildSubPageUrl(baseUrl: string, subPath: string): string {
  try {
    const url = new URL(baseUrl);
    // Remove trailing slash from path before appending sub-path
    let path = url.pathname;
    if (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }
    url.pathname = `${path}${subPath}`;
    return url.toString();
  } catch {
    return `${baseUrl.replace(/\/$/, '')}${subPath}`;
  }
}

// ---------------------------------------------------------------------------
// Page fetch helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a URL with timeout, returning the raw text content.
 * Tries direct HTTP fetch first, falls back to Jina Reader.
 */
async function fetchPageContent(url: string, label: string): Promise<string | null> {
  console.log(`    📄 [ResearchDoc] Fetching ${label}: ${url}`);

  // Try direct HTTP fetch
  try {
    const result = await resolveWebsite(url);
    if (result && result.quality !== 'failed' && result.rawText.length > 100) {
      console.log(`    ✅ [ResearchDoc] ${label} fetched via HTTP (${result.rawText.length} chars)`);
      return result.rawText;
    }
  } catch {
    // Fall through to Jina
  }

  // Try Jina Reader fallback
  try {
    const jinaResult = await fetchViaJina(url);
    if (jinaResult && jinaResult.rawText.length > 100) {
      console.log(`    ✅ [ResearchDoc] ${label} fetched via Jina (${jinaResult.rawText.length} chars)`);
      return jinaResult.rawText;
    }
  } catch {
    // Not available
  }

  console.log(`    ⚠️  [ResearchDoc] ${label} not available at ${url}`);
  return null;
}

/**
 * Fetch GitHub README content.
 * Uses the GitHub raw content API for the default branch.
 */
async function fetchGitHubReadme(githubUrl: string): Promise<string | null> {
  try {
    const match = githubUrl.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
    if (!match) return null;

    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');
    const readmeUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(readmeUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'DevScoutAI/1.0' },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const text = await response.text();
      if (text.length > 100) {
        console.log(`    ✅ [ResearchDoc] GitHub README fetched (${text.length} chars)`);
        return text;
      }
    }

    // Try 'master' branch if 'main' failed
    if (response.status === 404) {
      const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`;
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), FETCH_TIMEOUT_MS);

      const response2 = await fetch(masterUrl, {
        signal: controller2.signal,
        headers: { 'User-Agent': 'DevScoutAI/1.0' },
      });

      clearTimeout(timeoutId2);

      if (response2.ok) {
        const text = await response2.text();
        if (text.length > 100) {
          console.log(`    ✅ [ResearchDoc] GitHub README fetched (master branch, ${text.length} chars)`);
          return text;
        }
      }
    }

    return null;
  } catch (err) {
    console.warn(`    ⚠️  [ResearchDoc] GitHub README fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Content hash
// ---------------------------------------------------------------------------

/**
 * Compute a content hash from all research document fields.
 */
function computeDocHash(fields: Record<string, string | null>): string {
  const combined = Object.values(fields)
    .filter((v): v is string => v !== null)
    .join('\n---\n');
  return crypto.createHash('sha256').update(combined, 'utf-8').digest('hex');
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Build a research document for a tool.
 *
 * Fetches the tool's homepage, /docs page, /pricing page, and GitHub README
 * (if a GitHub URL is available) in parallel. Combines them into a single
 * structured markdown document and stores the result in the research_documents
 * table.
 *
 * @param params.toolId - The tool's UUID
 * @param params.toolName - The tool's display name
 * @param params.websiteUrl - The tool's website URL (required)
 * @param params.githubUrl - The tool's GitHub repo URL (optional)
 * @returns The combined markdown text, or null if nothing could be fetched
 */
export async function buildResearchDoc(params: {
  toolId: string;
  toolName: string;
  websiteUrl: string;
  githubUrl?: string | null;
}): Promise<string | null> {
  const { toolId, toolName, websiteUrl, githubUrl } = params;

  console.log(`  🔬 [ResearchDoc] Building research document for "${toolName}"...`);

  // Build all URLs to fetch
  const homepageUrl = websiteUrl;
  const docsUrl = buildSubPageUrl(websiteUrl, DEFAULT_SUB_PATHS.docs);
  const pricingUrl = buildSubPageUrl(websiteUrl, DEFAULT_SUB_PATHS.pricing);

  // Fetch all pages in parallel with individual timeouts
  const [homepageMd, docsMd, pricingMd, githubReadmeMd] = await Promise.all([
    fetchPageContent(homepageUrl, 'homepage'),
    fetchPageContent(docsUrl, 'docs'),
    fetchPageContent(pricingUrl, 'pricing'),
    githubUrl ? fetchGitHubReadme(githubUrl) : Promise.resolve(null),
  ]);

  // Check if we got anything useful
  const hasContent = homepageMd || docsMd || pricingMd || githubReadmeMd;
  if (!hasContent) {
    console.log(`  ⚠️  [ResearchDoc] No content fetched for "${toolName}"`);
    return null;
  }

  // Build combined markdown
  let combined = `# Research Document: ${toolName}\n\n`;

  if (homepageMd) {
    combined += `## Homepage\n\n${homepageMd}\n\n`;
  }

  if (docsMd) {
    combined += `## Documentation\n\n${docsMd}\n\n`;
  }

  if (pricingMd) {
    combined += `## Pricing\n\n${pricingMd}\n\n`;
  }

  if (githubReadmeMd) {
    combined += `## GitHub README\n\n${githubReadmeMd}\n\n`;
  }

  // Compute content hash
  const contentHash = computeDocHash({
    homepage_md: homepageMd,
    docs_md: docsMd,
    pricing_md: pricingMd,
    github_readme_md: githubReadmeMd,
  });

  // Store in database
  try {
    await upsertResearchDoc({
      tool_id: toolId,
      homepage_md: homepageMd,
      docs_md: docsMd,
      pricing_md: pricingMd,
      github_readme_md: githubReadmeMd,
      content_hash: contentHash,
      metadata: {
        sources: {
          homepage: !!homepageMd,
          docs: !!docsMd,
          pricing: !!pricingMd,
          github_readme: !!githubReadmeMd,
        },
        charCounts: {
          homepage: homepageMd?.length || 0,
          docs: docsMd?.length || 0,
          pricing: pricingMd?.length || 0,
          github_readme: githubReadmeMd?.length || 0,
        },
      },
    });
    console.log(`  💾 [ResearchDoc] Stored research document for "${toolName}"`);
  } catch (err) {
    console.error(`  ❌ [ResearchDoc] Failed to store research document for "${toolName}": ${err}`);
    // Non-fatal — return the combined text even if storage failed
  }

  console.log(`  ✅ [ResearchDoc] Research document built for "${toolName}" (${combined.length} chars)`);
  return combined;
}
```

## Part C — Backend Engineer

### Files Likely to Change (Part C)

| File | Change |
|------|--------|
| `lib/analyze/prompt.ts` | **Modify** — update `buildAnalysisPrompt()` to accept research doc |
| `lib/analyze/analyze-tool.ts` | **Modify** — accept optional `researchDoc` parameter |
| `lib/analyze/index.ts` | **Modify** — call `buildResearchDoc()` before analysis, pass result to `analyzeTool()` |

### Implementation Requirements (Part C)

#### Step C1: Update `lib/analyze/prompt.ts`

Update `buildAnalysisPrompt()` to combine research doc with raw text:

```typescript
export function buildAnalysisPrompt(options: {
  toolName: string;
  rawText?: string | null;
  researchDoc?: string | null;
}): string {
  const { toolName, rawText, researchDoc } = options;

  let prompt = `Analyze the following developer tool based on its scraped web page text.\n\n`;
  prompt += `Tool Name: ${toolName}\n\n`;

  if (researchDoc) {
    prompt += `## Research Document (combined from homepage, docs, pricing, and GitHub README)\n\n`;
    prompt += `${researchDoc}\n\n`;
  }

  if (rawText) {
    prompt += `## Raw Scraped Page Text (original source listing)\n\n`;
    prompt += `${rawText}\n\n`;
  }

  prompt += `Return a JSON object with the analysis fields as specified in the system prompt.`;
  return prompt;
}
```

#### Step C2: Update `lib/analyze/analyze-tool.ts`

Update `analyzeTool()` signature to accept optional `researchDoc`:

```typescript
export async function analyzeTool(
  toolId: string,
  toolName: string,
  rawText: string,
  researchDoc?: string | null
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
        prompt: buildAnalysisPrompt({ toolName, rawText, researchDoc }),
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
```

#### Step C3: Update `lib/analyze/index.ts`

Update `runAnalysisPipeline()` to build research docs before analysis:

1. **Add imports** at top:
   ```typescript
   import { buildResearchDoc } from './research-doc';
   ```

2. **After the skipped check** (line 130) and before calling `analyzeTool`, add research doc building:
   ```typescript
   // Build research document for richer AI analysis
   let researchDoc: string | null = null;
   if (tool.website_url) {
     try {
       researchDoc = await buildResearchDoc({
         toolId: tool.id,
         toolName: tool.name,
         websiteUrl: tool.website_url,
         githubUrl: tool.website_url.includes('github.com') ? tool.website_url : null,
       });
     } catch (err) {
       console.warn(`  ⚠️  [Analysis] Research doc build failed for ${tool.name}: ${err}`);
       // Non-fatal — continue with raw_text only
     }
   }
   ```

3. **Update the `analyzeTool` call** (line 134) to pass the research doc:
   ```typescript
   const result = await analyzeTool(tool.id, tool.name, tool.raw_text, researchDoc);
   ```

4. **Handle the case where `tool.raw_text` could be null** — already handled by the skip check at line 124-130.

## Security Requirements

- All files start with `import 'server-only';`
- `research_documents` table has no anon access — service role only
- Research document data is never exposed to browser code directly
- No new env vars required — reuse existing `OPENAI_API_KEY` and fetch infrastructure

## Acceptance Criteria

### Part A
1. `research_documents` table created in `supabase/schema.sql` with correct schema
2. `ResearchDocument`, `InsertResearchDocumentParams` types added to `lib/supabase/types.ts`
3. `research_documents` entry in `Database` type's `Tables`
4. `lib/supabase/queries/research-documents.ts` with `getResearchDocByToolId()`, `upsertResearchDoc()`, `updateResearchDoc()`, `deleteResearchDocByToolId()`
5. Module exported from `lib/supabase/queries/index.ts`

### Part B
6. `lib/analyze/research-doc.ts` exists with `buildResearchDoc()`
7. Fetches homepage, /docs, /pricing in parallel with 10s timeouts
8. Fetches GitHub README if githubUrl provided
9. Combines all content into structured markdown
10. Stores result in `research_documents` table via `upsertResearchDoc()`

### Part C
11. `buildAnalysisPrompt()` accepts `researchDoc` parameter and includes it in the prompt
12. `analyzeTool()` accepts optional `researchDoc` parameter
13. `runAnalysisPipeline()` builds research docs before analysis
14. Falls back to `raw_text` when research document is unavailable
15. Analysis output schema unchanged
16. `npm run typecheck` passes with zero errors
17. `npm run lint` passes with zero new errors

## Checks to Run

- `npm run typecheck` — TypeScript, no emit
- `npm run lint` — ESLint
- `npm run build` — Next.js production build

## Exact Manual Test Steps (All Parts)

1. **Run the SQL** in Supabase Dashboard → SQL Editor:
   ```sql
   -- Run the research_documents table creation SQL from supabase/schema.sql
   ```

2. **Trigger AI analysis** to test the full flow:
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "Content-Type: application/json" \
     -H "x-devscout-admin-secret: YOUR_ADMIN_SECRET" \
     -d '{"limit": 1}'
   ```

3. **Watch the console** for research doc build logs:
   - `[ResearchDoc] Building research document for "ToolName"...`
   - `[ResearchDoc] Homepage fetched via HTTP (X chars)`
   - `[ResearchDoc] Docs fetched via Jina (Y chars)`
   - `[ResearchDoc] Stored research document for "ToolName"`

4. **Verify in Supabase** that `research_documents` has rows with populated `homepage_md`, `docs_md`, `pricing_md`.

5. **Verify analysis still works** — confirm the analysis summary shows `analyzed: 1` and no failures.

6. Run `npm run typecheck && npm run lint && npm run build` — all must pass.
