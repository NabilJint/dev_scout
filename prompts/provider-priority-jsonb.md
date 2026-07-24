# Prompt: JSONB provider_priority on tool_sources

## Goal

Add a `provider_priority` JSONB column to the `tool_sources` table that stores the ordered list of content-fetch providers (e.g., `["http", "oxylabs"]` or `[{provider: "http", timeout: 5000}, {provider: "oxylabs"}]`) for each source. This enables per-source provider fallback configuration without hardcoding provider logic in the pipeline, and supports both simple string-array and extended object-array syntax for per-provider options.

## Assigned Specialist Agent(s)

- **Database Engineer** (schema change, types update)
- **Backend Engineer** (consume provider_priority in enrichment/fetch logic)
- **Code Reviewer** (review diff)
- **QA Engineer** (run checks)

## Skills Read

- `supabase` — Supabase schema patterns, JSONB column best practices, ALTER TABLE
- Existing `AGENTS.md` — Sections 7 (tool_sources table), 21 (security, code standards)

## Existing Code Inspected

- `supabase/schema.sql` — `tool_sources` table definition (lines 12-20)
- `lib/supabase/types.ts` — `ToolSource`, `InsertSourceParams`, `UpdateSourceParams` interfaces
- `lib/supabase/queries/sources.ts` — `getActiveSources`, `getSourceById`, `updateSource`
- `lib/enrichment/index.ts` — enrichment provider logic (direct fetch → Jina fallback)
- `lib/enrichment/resolve-website.ts` — the actual HTTP fetch logic
- `lib/enrichment/jina-fallback.ts` — Jina Reader alternative provider
- `lib/scrape/pipeline.ts` — where source provider is currently hardcoded (Oxylabs for homepage, direct HTTP for enrichment)

## Decisions or Assumptions

1. **JSONB is used** (not `text[]`) to allow per-provider options in the future (e.g., `[{provider:"http", timeout:5000}, {provider:"oxylabs", render:true}]`). The initial implementation supports both syntaxes:
   - Simple: `["http", "oxylabs"]` — just provider names, default options.
   - Extended: `[{provider:"http", timeout:5000}, {provider:"oxylabs", render:true}]` — provider names with options.
2. **Provider priority is optional** — sources without `provider_priority` default to `["http"]` (direct HTTP fetch only) for backward compatibility.
3. **Provider names are** a closed set initially: `"http"` (direct fetch via Cheerio/resolve-website), `"oxylabs"` (Oxylabs Web Scraper API), `"jina"` (Jina Reader fallback). The `"http"` provider is the default for all sources.
4. **The pipeline reads `provider_priority`** at fetch time and iterates through providers in order until one succeeds. This replaces the current hardcoded fetch strategy in enrichment.
5. **No UI changes** — this is a backend-only schema and pipeline integration change. The provider_priority field is set via SQL or the data API directly.
6. **Existing behavior is preserved** when `provider_priority` is NULL — traditional single-provider fallback (HTTP → Jina) continues to work.
7. **Default value for new sources** is set application-side in `insertSource`, not in the schema default.

## Files Likely to Change

| File | Change |
|------|--------|
| `supabase/schema.sql` | ALTER TABLE tool_sources ADD COLUMN provider_priority JSONB |
| `lib/supabase/types.ts` | Update `ToolSource`, `InsertSourceParams`, `UpdateSourceParams` to include `provider_priority` |
| `lib/supabase/queries/sources.ts` | Update `insertSource` to handle `provider_priority` |
| `lib/scrape/types.ts` | Add `ProviderName` type, `ProviderConfig` interface, `ProviderPriority` union type |
| `lib/scrape/pipeline.ts` | Read `provider_priority` from source, use it to determine fetch strategy |
| `lib/enrichment/resolve-website.ts` | (No change — already a single provider) |
| `lib/enrichment/jina-fallback.ts` | (No change — already a single provider) |
| `.env.example` | No change needed |

## Implementation Requirements

### Step 1: ALTER TABLE SQL

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Add provider_priority JSONB column for per-source provider configuration
alter table public.tool_sources add column if not exists provider_priority jsonb;

-- GIN index for JSONB queries (useful if querying by provider name in the future)
create index if not exists idx_tool_sources_provider_priority
  on public.tool_sources using gin (provider_priority);
```

Add to `supabase/schema.sql` in the tool_sources table definition (after `parser_strategy text,`):

```sql
    provider_priority jsonb,
```

Add the index after existing tool_sources indexes:

```sql
create index if not exists idx_tool_sources_provider_priority
  on public.tool_sources using gin (provider_priority);
```

### Step 2: Add TypeScript types in `lib/supabase/types.ts`

Update the `ToolSource` interface:

```typescript
export interface ToolSource {
  id: string;
  name: string;
  listing_url: string;
  logo_url: string | null;
  active: boolean;
  parser_strategy: string | null;
  provider_priority: Json | null;  // NEW — JSONB column
  created_at: string;
}
```

Update `InsertSourceParams`:

```typescript
export interface InsertSourceParams {
  name: string;
  listing_url: string;
  logo_url?: string | null;
  active?: boolean;
  parser_strategy?: string | null;
  provider_priority?: Json | null;  // NEW — optional
}
```

Update `UpdateSourceParams`:

```typescript
export interface UpdateSourceParams {
  id: string;
  name?: string;
  listing_url?: string;
  logo_url?: string | null;
  active?: boolean;
  parser_strategy?: string | null;
  provider_priority?: Json | null;  // NEW — optional
}
```

### Step 3: Add provider types in `lib/scrape/types.ts`

```typescript
/**
 * Known content-fetch provider names.
 */
export type ProviderName = 'http' | 'oxylabs' | 'jina';

/**
 * Simple provider reference: just the name.
 */
export interface ProviderConfig {
  provider: ProviderName;
  /** Provider-specific options (optional, per-provider semantics). */
  timeout?: number;
  render?: boolean;
  [key: string]: unknown;
}

/**
 * Provider priority can be specified as:
 * - An array of provider name strings: ["http", "oxylabs"]
 * - An array of provider config objects: [{provider: "http", timeout: 5000}, {provider: "oxylabs"}]
 * - null (default: ["http"])
 */
export type ProviderPriority = ProviderName[] | ProviderConfig[] | null;
```

### Step 4: Create a provider resolution utility in `lib/scrape/pipeline.ts` or a new `lib/scrape/providers.ts`

Create a new file `lib/scrape/providers.ts` with:

```typescript
import 'server-only';
import type { ProviderName, ProviderConfig, ProviderPriority } from './types';

// lib/scrape/providers.ts
// Provider priority resolution — determines which fetch provider to use
// for a given source based on its provider_priority JSONB column.

/**
 * Default provider priority when none is configured on the source.
 */
const DEFAULT_PROVIDER_PRIORITY: ProviderName[] = ['http'];

/**
 * Parse a provider_priority value into an ordered array of ProviderConfig objects.
 * Normalizes both string-array and object-array formats.
 *
 * @param priority - Raw JSONB value from tool_sources.provider_priority
 * @returns Ordered array of ProviderConfig objects
 */
export function parseProviderPriority(priority: ProviderPriority): ProviderConfig[] {
  if (!priority || !Array.isArray(priority)) {
    return DEFAULT_PROVIDER_PRIORITY.map(p => ({ provider: p }));
  }

  if (priority.length === 0) {
    return DEFAULT_PROVIDER_PRIORITY.map(p => ({ provider: p }));
  }

  return priority.map(item => {
    if (typeof item === 'string') {
      // Simple string format: "http"
      return { provider: item as ProviderName };
    }
    // Object format: { provider: "http", timeout: 5000 }
    return item as ProviderConfig;
  });
}

/**
 * Get the primary (first) provider for a source.
 * This is the provider that should be tried first.
 */
export function getPrimaryProvider(priority: ProviderPriority): ProviderConfig {
  const providers = parseProviderPriority(priority);
  return providers[0];
}

/**
 * Check if a specific provider is configured in the priority list.
 */
export function hasProvider(priority: ProviderPriority, name: ProviderName): boolean {
  const providers = parseProviderPriority(priority);
  return providers.some(p => p.provider === name);
}
```

### Step 5: Update `lib/supabase/queries/sources.ts`

Update `insertSource` to handle `provider_priority`:

```typescript
export async function insertSource(params: InsertSourceParams): Promise<ToolSource> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('tool_sources')
    .insert({
      name: params.name,
      listing_url: params.listing_url,
      logo_url: params.logo_url ?? null,
      active: params.active ?? true,
      parser_strategy: params.parser_strategy ?? null,
      provider_priority: params.provider_priority ?? null,  // NEW
    })
    .select()
    .single()
    .overrideTypes<ToolSource, { merge: false }>();

  // ... error handling (unchanged) ...
}
```

Update `updateSource` to handle `provider_priority`:

```typescript
export async function updateSource(params: UpdateSourceParams): Promise<ToolSource> {
  const supabase = await createServerClient();

  const updates: Partial<Omit<ToolSource, 'id' | 'created_at'>> = {};
  if (params.name !== undefined) updates.name = params.name;
  if (params.listing_url !== undefined) updates.listing_url = params.listing_url;
  if (params.logo_url !== undefined) updates.logo_url = params.logo_url;
  if (params.active !== undefined) updates.active = params.active;
  if (params.parser_strategy !== undefined) updates.parser_strategy = params.parser_strategy;
  if (params.provider_priority !== undefined) updates.provider_priority = params.provider_priority;  // NEW

  // ... rest unchanged ...
}
```

### Step 6: Integrate into Pipeline Fetch Strategy

In `lib/scrape/pipeline.ts`, replace hardcoded render logic with provider-priority-based logic:

**Current code (line 189-191):**
```typescript
const render = sourceNeedsRender(strategy);
const homepageResult = await scrapeUrl(source.listing_url, { render });
```

**New code:**
```typescript
import { parseProviderPriority, hasProvider } from './providers';

// ... inside runScrapePipeline:

const providerPriority = parseProviderPriority(source.provider_priority as ProviderPriority);
const useOxylabs = providerPriority.some(p => p.provider === 'oxylabs');
const renderOption = providerPriority.find(p => p.provider === 'oxylabs')?.render ?? sourceNeedsRender(strategy);

let homepageResult;
if (useOxylabs || sourceNeedsRender(strategy)) {
  homepageResult = await scrapeUrl(source.listing_url, { render: renderOption as boolean | undefined });
} else {
  // HTTP direct fetch as primary provider
  const { resolveWebsite } = await import('@/lib/enrichment/resolve-website');
  const resolved = await resolveWebsite(source.listing_url);
  homepageResult = {
    content: resolved?.rawText || null,
    error: resolved?.quality === 'failed' ? 'Direct fetch failed' : undefined,
  };
}
// ... same error handling as before ...
```

**Important:** The above is an illustrative simplification. In practice:
1. If `provider_priority` explicitly lists providers, iterate through them in order until one succeeds.
2. If `provider_priority` is null, fall back to current behavior (Oxylabs for render-needed sources, otherwise HTTP fetch for homepage).
3. Keep the `sourceNeedsRender(strategy)` function as a default fallback when `provider_priority` is null.

A more robust approach:

```typescript
async function fetchWithProviderPriority(
  url: string,
  source: ToolSource,
  strategy: string
): Promise<{ content: string | null; error?: string }> {
  const rawPriority = source.provider_priority as ProviderPriority;
  const providers = parseProviderPriority(rawPriority);

  for (const provider of providers) {
    switch (provider.provider) {
      case 'http': {
        const { resolveWebsite } = await import('@/lib/enrichment/resolve-website');
        const result = await resolveWebsite(url);
        if (result && result.quality !== 'failed') {
          return { content: result.rawText };
        }
        break;
      }
      case 'oxylabs': {
        const result = await scrapeUrl(url, {
          render: provider.render ?? sourceNeedsRender(strategy),
        });
        if (!result.error && result.content) {
          return { content: result.content };
        }
        break;
      }
      case 'jina': {
        const { fetchViaJina } = await import('@/lib/enrichment/jina-fallback');
        const result = await fetchViaJina(url);
        if (result && result.rawText) {
          return { content: result.rawText };
        }
        break;
      }
    }
  }

  // Fallback: try default method
  if (sourceNeedsRender(strategy)) {
    const result = await scrapeUrl(url, { render: true });
    return { content: result.content, error: result.error };
  }
  return { content: null, error: 'All providers failed' };
}
```

### Step 7: Update `.env.example` (if needed)

No changes needed — `provider_priority` is a DB-level field, not an environment variable.

### Step 8: Seed existing sources with provider_priority

Provide SQL to set initial provider_priority values for existing sources:

```sql
-- Set default provider_priority for all existing active sources
update public.tool_sources
set provider_priority = '["http", "oxylabs", "jina"]'::jsonb
where provider_priority is null;

-- Or, per-source custom configurations:
-- update public.tool_sources
-- set provider_priority = '["oxylabs"]'::jsonb
-- where parser_strategy in ('producthunt', 'reddit', 'github-trending');
```

## Security Requirements

- `provider_priority` is stored server-side in Supabase only — never exposed to browser code via the anon key.
- The `tool_sources` anon policy only allows reading `active = true` rows (already exists). Add the `provider_priority` column to the select; it's safe since it's just provider configuration, not credentials.
- Credentials (Oxylabs username/password, API keys) remain in environment variables — never in the DB.
- No changes to admin secret or credential handling.

## Acceptance Criteria

1. ALTER TABLE SQL runs cleanly and adds `provider_priority JSONB` column to `tool_sources`.
2. GIN index is created for JSONB queries.
3. `ToolSource` interface includes `provider_priority: Json | null`.
4. `InsertSourceParams` and `UpdateSourceParams` include optional `provider_priority`.
5. `ProviderName`, `ProviderConfig`, `ProviderPriority` types are defined in `lib/scrape/types.ts`.
6. `parseProviderPriority()` function normalizes both string-array and object-array formats.
7. Pipeline uses `provider_priority` to determine fetch strategy, falling back to current behavior when NULL.
8. Existing sources without `provider_priority` continue to work exactly as before.
9. Seed SQL is provided to set initial values.
10. `npm run typecheck` passes with zero errors.
11. `npm run lint` passes with zero new errors.

## Checks to Run

- `npm run typecheck` — TypeScript no-emit
- `npm run lint` — ESLint
- `npm run build` — Next.js production build

## Exact Manual Test Steps

1. Run the ALTER TABLE SQL in Supabase Dashboard → SQL Editor.
2. Add the GIN index.
3. Verify the column exists: `SELECT provider_priority FROM public.tool_sources LIMIT 1;`
4. Set provider_priority for a test source:
   ```sql
   UPDATE public.tool_sources
   SET provider_priority = '["http", "oxylabs"]'::jsonb
   WHERE id = '<a-source-uuid>';
   ```
5. Run `npm run dev`.
6. Trigger a scrape with that source:
   `curl -X POST http://localhost:3000/api/scrape -H "x-devscout-admin-secret: YOUR_SECRET" -H "Content-Type: application/json" -d '{"sourceIds": ["<a-source-uuid>"], "perSourceLimit": 1}'`
7. Watch terminal output for fetch provider selection. If `provider_priority` lists `"http"` first, the pipeline should try direct HTTP before falling back to Oxylabs.
8. Test fallback: set `provider_priority = '["http"]'::jsonb` for a source where direct HTTP fails — verify the pipeline falls through (or uses the default fallback if needed).
9. Test object-array syntax:
   ```sql
   UPDATE public.tool_sources
   SET provider_priority = '[{"provider": "http", "timeout": 3000}, {"provider": "oxylabs", "render": true}]'::jsonb
   WHERE id = '<a-source-uuid>';
   ```
10. Re-run the scrape and verify the object-syntax is parsed correctly and the options are respected.
11. Reset to NULL: `UPDATE public.tool_sources SET provider_priority = NULL WHERE id = '<a-source-uuid>';` — verify the existing default behavior is preserved.
