# Prompt: Content Hash Deduplication

## Goal

Add a `content_hash` column to the `tools` table that stores a SHA-256 hex digest of the tool's `raw_text`. This enables content-based deduplication — detecting when the same tool content has been scraped under a different URL or source — by checking the content hash at insert time instead of relying solely on URL deduplication.

## Assigned Specialist Agent(s)

- **Database Engineer** (schema change, types update)
- **Backend Engineer** (hash computation in pipeline, dedupe check at insert)
- **Code Reviewer** (review diff)
- **QA Engineer** (run checks)

## Skills Read

- `supabase` — Supabase schema patterns, ALTER TABLE, types
- Existing `AGENTS.md` — Sections 7, 9, 10, 13

## Existing Code Inspected

- `supabase/schema.sql` — `tools` table definition (lines 49-69)
- `lib/supabase/types.ts` — `Tool`, `InsertToolParams` interfaces
- `lib/supabase/queries/tools.ts` — `insertTool`, `insertTools`, `checkToolsExistByOriginalUrls`
- `lib/scrape/pipeline.ts` — where `insertTool` is called (lines 493-508)
- `lib/scrape/validate.ts` — `cleanRawText`, `validateToolContent`
- `lib/scrape/types.ts` — `ScrapedTool` interface

## Decisions or Assumptions

1. **SHA-256 is computed server-side** using Node.js `crypto` module — no external dependencies.
2. **The hash is computed AFTER `cleanRawText()`** runs, so the hash reflects normalized/cleaned content, not raw HTML.
3. **A unique index on `content_hash`** allows the database to enforce content uniqueness at the storage level.
4. **Hashes are nullable** — existing rows without content_hash get `NULL`. A unique index with `NULLS NOT DISTINCT` (PostgreSQL 15+) ensures uniqueness only for non-null values. If `NULLS NOT DISTINCT` is not available (Supabase may be on an older PG version), use a partial unique index: `CREATE UNIQUE INDEX ... WHERE content_hash IS NOT NULL`.
5. **URL deduplication still happens first** (existing behavior). Content hash deduplication is an *additional* check before insert to catch same-content-different-URL duplicates.
6. **Content hash check is best-effort** — if `raw_text` is null/empty, skip the hash check and don't block the insert.
7. **The hash is stored as a hex string** (64 characters for SHA-256).

## Files Likely to Change

| File | Change |
|------|--------|
| `supabase/schema.sql` | ALTER TABLE tools ADD COLUMN content_hash TEXT, add unique partial index |
| `lib/supabase/types.ts` | Add `content_hash` to `Tool` and `InsertToolParams` |
| `lib/supabase/queries/tools.ts` | Add `checkToolsExistByContentHashes`, update `insertTool` to compute/dedupe by hash |
| `lib/scrape/types.ts` | No change needed (hash computed at insert time) |
| `lib/scrape/pipeline.ts` | Compute content_hash before calling insertTool, pass it in params |
| `lib/scrape/validate.ts` | Export `computeContentHash` utility function |

## Implementation Requirements

### Step 1: ALTER TABLE SQL

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Add content_hash column for content-based deduplication
alter table public.tools add column if not exists content_hash text;

-- Partial unique index: only non-null hashes are checked for uniqueness.
-- This avoids blocking inserts on rows without a hash.
create unique index if not exists idx_tools_content_hash
  on public.tools (content_hash)
  where content_hash is not null;
```

Also add to `supabase/schema.sql` in the tools table definition (after `raw_text text,`):

```sql
    content_hash text,
```

Add the index after existing tools indexes:

```sql
create unique index if not exists idx_tools_content_hash
  on public.tools (content_hash)
  where content_hash is not null;
```

**Important**: The partial unique index is used (not `NULLS NOT DISTINCT`) to maintain compatibility with PostgreSQL versions below 15, which Supabase may use.

### Step 2: Update TypeScript types in `lib/supabase/types.ts`

Update the `Tool` interface:

```typescript
export interface Tool {
  // ... existing fields ...
  raw_text: string | null;
  content_hash: string | null;  // NEW — SHA-256 hex digest
  // ... remaining fields ...
}
```

Update `InsertToolParams`:

```typescript
export interface InsertToolParams {
  // ... existing fields ...
  raw_text?: string | null;
  content_hash?: string | null;  // NEW — computed from raw_text before insert
  // ... remaining fields ...
}
```

### Step 3: Create `computeContentHash` utility in `lib/scrape/validate.ts`

Add this function to the existing validate.ts file:

```typescript
import crypto from 'crypto';

// ... existing code ...

/**
 * Compute a SHA-256 content hash from raw text.
 * Returns null if the input is null, undefined, or empty.
 * The hash is computed on the trimmed, whitespace-normalized text
 * so that minor formatting differences don't change the hash.
 */
export function computeContentHash(raw_text: string | null | undefined): string | null {
  if (!raw_text || raw_text.trim().length === 0) {
    return null;
  }

  // Normalize whitespace before hashing to catch formatting-only differences
  const normalized = raw_text
    .replace(/\s+/g, ' ')
    .trim();

  return crypto.createHash('sha256').update(normalized, 'utf-8').digest('hex');
}
```

### Step 4: Add content hash check function in `lib/supabase/queries/tools.ts`

Add a new query function:

```typescript
/**
 * Check which content hashes already exist in the tools table.
 * Returns a Set of hashes that are already stored.
 * Only checks non-null hashes.
 */
export async function checkHashesExist(contentHashes: string[]): Promise<Set<string>> {
  // Filter out empty/null hashes
  const validHashes = contentHashes.filter(h => h && h.length > 0);
  if (validHashes.length === 0) return new Set();

  const supabase = await createServerReadOnlyClient();

  // Query in chunks of 15 to avoid PostgREST URL length limits
  const chunkSize = 15;
  const existingHashes = new Set<string>();

  for (let i = 0; i < validHashes.length; i += chunkSize) {
    const chunk = validHashes.slice(i, i + chunkSize);

    const { data, error } = await supabase
      .from('tools')
      .select('content_hash')
      .in('content_hash', chunk);

    if (error) {
      console.error('Error checking content hash existence:', error);
      throw new Error(`Failed to check content hashes: ${error.message}`);
    }

    data?.forEach(row => {
      if (row.content_hash) existingHashes.add(row.content_hash);
    });
  }

  return existingHashes;
}
```

### Step 5: Update `lib/scrape/pipeline.ts` to compute and check content hashes

In the `processHomepageContent` function, after validation passes and before calling `insertTool`:

1. Compute the content hash from the cleaned/final `rawText`:
   ```typescript
   const contentHash = computeContentHash(scrapedTool.rawText);
   ```

2. If `contentHash` is not null, check it against existing hashes using the new `checkHashesExist` function.

3. If the hash already exists in the DB, log a duplicate-skip and continue (don't insert).

4. Pass `content_hash` in the insert params:

```typescript
const contentHash = computeContentHash(scrapedTool.rawText);

// Content-based deduplication (additional to URL deduplication)
if (contentHash) {
  const existingHashes = await checkHashesExist([contentHash]);
  if (existingHashes.has(contentHash)) {
    duplicatesSkipped++;
    console.log(`    🔁 [Pipeline] Content hash duplicate: "${scrapedTool.title}" — skipping (same content as existing tool)`);
    continue;
  }
}

// ... existing code ...
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
  content_hash: contentHash,  // NEW
};
```

### Step 6: Update `PipelineSummary` to track hash-skipped duplicates

Optionally add a `contentDuplicatesSkipped` field to `PipelineSummary` in `lib/scrape/types.ts` to distinguish URL-based dedup from content-based dedup:

```typescript
export interface PipelineSummary {
  // ... existing fields ...
  duplicatesSkipped: number;
  contentDuplicatesSkipped?: number;  // NEW — optional, content-hash-level dedup
  // ... remaining fields ...
}
```

This field is optional so existing callers don't break.

### Step 7: Backfill content hashes for existing tools

Create a one-time backfill script or include SQL:

```sql
-- Backfill content_hash for existing tools with raw_text
update public.tools
set content_hash = encode(
  sha256(
    regexp_replace(coalesce(raw_text, ''), '\s+', ' ', 'g')::bytea
  ),
  'hex'
)
where raw_text is not null and raw_text != '' and content_hash is null;
```

**Note**: This SQL uses `sha256()` which may not be available as a PostgreSQL function. If not, the backfill can be done via a Node.js script. The easiest approach is to instruct the admin to run the pipeline on existing tools (they'll be re-processed through the normal flow) — but for prompt purposes, note this as a "run after deploy" step.

> **Recommendation**: For backfilling existing tools, run a simple Node.js script that:
> 1. Fetches all tools where `content_hash IS NULL` and `raw_text IS NOT NULL`.
> 2. For each tool, computes `computeContentHash(raw_text)`.
> 3. Updates the tool row: `UPDATE tools SET content_hash = $1 WHERE id = $2`.
> This is safer than SQL-level SHA-256 which requires `pgcrypto` extension functions.

## Security Requirements

- `crypto.createHash('sha256')` is a Node.js built-in, server-only — safe.
- Content hashes are never exposed to browser code.
- No changes to admin secret or cron secret patterns.
- The `content_hash` column is readable by anon (part of `SELECT *` on tools), but this is harmless — it's just a hash, not sensitive data. To minimize exposure, the frontend queries should not request `raw_text` or `content_hash` in select statements.

## Acceptance Criteria

1. ALTER TABLE SQL runs cleanly and adds `content_hash TEXT` column to `tools`.
2. Partial unique index `idx_tools_content_hash` is created (non-null only).
3. `computeContentHash(raw_text)` function exists in `lib/scrape/validate.ts` and returns a 64-char hex string.
4. `checkHashesExist` query function exists in `lib/supabase/queries/tools.ts`.
5. Pipeline computes content hash before inserting a tool.
6. Pipeline checks for existing content hash and skips duplicates with a log message.
7. Content hash is passed in `InsertToolParams` and stored in the DB.
8. Existing tools with `raw_text IS NULL` get `content_hash = NULL`.
9. Backfill SQL or script instructions are provided.
10. All existing behavior unchanged: URL deduplication still runs first; content hash check is additive.
11. `npm run typecheck` passes with zero errors.
12. `npm run lint` passes with zero new errors.

## Checks to Run

- `npm run typecheck` — TypeScript no-emit
- `npm run lint` — ESLint
- `npm run build` — Next.js production build

## Exact Manual Test Steps

1. Run the ALTER TABLE SQL in Supabase Dashboard → SQL Editor.
2. Create the partial unique index.
3. Run `npm run dev`.
4. Trigger a manual scrape: `curl -X POST http://localhost:3000/api/scrape -H "x-devscout-admin-secret: YOUR_SECRET" -H "Content-Type: application/json" -d '{"sourceIds": ["<a-source-uuid>"], "perSourceLimit": 1}'`
5. Verify the new tool has a content_hash: `SELECT id, name, content_hash FROM public.tools WHERE content_hash IS NOT NULL ORDER BY created_at DESC LIMIT 5;`
6. Run the same scrape again (same source, same tool should be found). Verify the content hash duplicate check logs: `🔁 [Pipeline] Content hash duplicate: "..." — skipping`
7. Backfill existing tools using the Node.js script approach (recommended) or SQL.
8. Verify `checkHashesExist` works by running a tool that was previously scraped — it should be skipped by content hash even if the URL is different.
