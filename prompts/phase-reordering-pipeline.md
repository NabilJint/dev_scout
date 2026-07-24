# Prompt: Pipeline Phase Reordering

## Goal

Restructure the scraping pipeline so that the **logging stage** fires **before the enrichment stage** within each tool's processing loop. Currently, `enrichTool()` is called early in the per-tool loop and enrichment failures can prevent downstream logging (the tool is skipped without recording why). Moving logging earlier ensures every tool's processing attempt — including enrichment failures — is recorded, making pipeline diagnostics more reliable.

Additionally, separate the monolithic per-tool processing block in `processHomepageContent` into clearly named **phases** that match the stage names from `prompts/pipeline-structured-logging.md` (`FETCH`, `EXTRACT`, `NORMALIZE`, `STORE`), making the pipeline easier to read, debug, and extend.

## Assigned Specialist Agent(s)

- **Backend Engineer** (primary — pipeline restructuring)
- **Code Reviewer** (review diff)
- **QA Engineer** (run checks)

## Skills Read

- Existing `AGENTS.md` — Sections 9 (scrape-to-insert pipeline), 13 (tool validation), 16 (manual scraping)
- Existing pipeline code at `lib/scrape/pipeline.ts`

## Existing Code Inspected

- `lib/scrape/pipeline.ts` — `processHomepageContent` (entire file, 538 lines)
- `lib/scrape/types.ts` — `PipelineSummary`, `ScrapedTool`
- `lib/enrichment/index.ts` — `enrichTool` function and return types
- `lib/enrichment/types.ts` — `EnrichedContent`, `LogoResult`, `EnrichmentResult`
- `lib/scrape/validate.ts` — `cleanRawText`, `validateToolContent`

## Decisions or Assumptions

1. **Logging before enrichment** means: for each candidate tool being processed, emit a structured log entry (using the stage logging from task 1) **before** calling `enrichTool()`. This way, if enrichment fails, we still have a record that we attempted to process this tool.
2. **The existing flow** is: scrape detail page → extract tool content → enrich → clean rawText → validate → insert. The new flow is: scrape detail page → extract tool content → **log processing attempt** → enrich → clean rawText → validate → insert.
3. **No behavior changes to enrichment logic** — the order of enrichment relative to `cleanRawText` and `validateToolContent` stays the same. Only the logging order changes.
4. **Phase separation** means extracting the per-tool processing into smaller named blocks or functions, not a full refactor. Use inline comments and `{ }` block scoping to label phases.
5. **All existing `console.log` calls remain.** This task only adds logging and reorganizes code — it does not remove anything.
6. **Existing pipeline behavior is preserved** when defaults are used. No breaking changes.

## Files Likely to Change

| File | Change |
|------|--------|
| `lib/scrape/pipeline.ts` | Reorder logging before enrichment, add phase comment blocks, extract per-tool phases into logical sections |
| `lib/scrape/types.ts` | No changes needed (optional: add phase-related typing if desired for clarity) |

## Implementation Requirements

### Step 1: Identify the current per-tool processing block

In `processHomepageContent` (around line 400-513), the per-tool processing loop currently does:

```typescript
for (const candidate of candidatesToProcess) {
  // 1. Scrape detail page (FETCH phase)
  const detailResult = await scrapeUrl(candidate.url, { render: true });

  // 2. Extract tool content (EXTRACT phase)
  const scrapedTool = parser.extractToolContent(detailResult.content);

  // 3. Set websiteUrl (part of NORMALIZE phase)
  // ...websiteUrl resolution...

  // 4. Enrich from tool website (ENRICH phase — currently BEFORE logging)
  const { enrichTool } = await import('@/lib/enrichment');
  // ... enrichment logic ...

  // 5. Clean raw text (EXTRACT / NORMALIZE phase)
  const cleanedRawText = cleanRawText(detailResult.content);
  scrapedTool.rawText = cleanedRawText;

  // 6. Validate (NORMALIZE phase)
  const validation = validateToolContent(scrapedTool);

  // 7. Insert (STORE phase)
  // ... insertTool call ...
}
```

### Step 2: Reorder logging before enrichment

Add a logging block **before** the enrichment import/call. This log should record:
- Tool name
- Source name
- Candidate URL
- Whether websiteUrl is available (for enrichment)

```typescript
// ---- Phase: LOG (processing attempt) ----
console.log(`  📝 [Pipeline] Processing "${scrapedTool.title}" from ${source.name} (website: ${scrapedTool.websiteUrl || 'none'})`);

// ---- Phase: ENRICH ----
```

If stage logging from `prompts/pipeline-structured-logging.md` is already implemented, use `logStageStart`/`logStageEnd` here. Otherwise, use a simple `console.log` that can later be upgraded.

### Step 3: Add phase comment blocks

Insert clear `// ---- Phase: <NAME> ----` comment blocks around each logical section of the per-tool loop. The phases are:

| Phase | Boundaries | Description |
|-------|-----------|-------------|
| `FETCH` | `candidate.url` → `scrapeUrl` → `detailResult` | Fetches the tool's detail page HTML |
| `EXTRACT` | `parser.extractToolContent(detailResult.content)` → `scrapedTool` | Parses HTML into structured ScrapedTool |
| `NORMALIZE` | `websiteUrl` resolution → `cleanRawText` → `validateToolContent` | Normalizes URLs, cleans text, validates |
| ~~(reorder candidate)~~ | ~~enrichment~~ | Move after LOG phase |
| `LOG` | `console.log` + optional `logStageStart` | Records the processing attempt |
| `ENRICH` | `import('@/lib/enrichment')` → `enrichTool` → content replacement | Fetches tool website content |
| `STORE` | `computeContentHash` → `insertTool` call | Inserts into database |

### Step 4: Refactor the per-tool processing into named sections

Wrap each phase in a labeled block using inline comments and/or extracted helper functions. Example structure:

```typescript
for (const candidate of candidatesToProcess) {
  // ===================================================================
  // PHASE: FETCH — Scrape the tool's detail page
  // ===================================================================
  const detailResult = await scrapeUrl(candidate.url, { render: true });
  if (detailResult.error) {
    console.error(`    ❌ [Pipeline:FETCH] Failed: ${candidate.url} — ${detailResult.error}`);
    toolsFailed++;
    continue;
  }
  detailPagesScraped++;

  // ===================================================================
  // PHASE: EXTRACT — Parse HTML into structured tool data
  // ===================================================================
  let scrapedTool: ScrapedTool | null = null;
  try {
    scrapedTool = parser.extractToolContent(detailResult.content);
  } catch (err) {
    console.error(`    ❌ [Pipeline:EXTRACT] Parser error: ${candidate.url} — ${err}`);
    toolsFailed++;
    continue;
  }
  if (!scrapedTool) {
    console.error(`    ❌ [Pipeline:EXTRACT] Failed to parse: ${candidate.url}`);
    toolsFailed++;
    continue;
  }

  // ===================================================================
  // PHASE: NORMALIZE — Resolve website URL, clean text, validate
  // ===================================================================
  // websiteUrl resolution logic (unchanged, see existing code lines 430-446)
  // ...resolve websiteUrl from candidate, source, or parser...

  // ---- LOG ----
  // Now log BEFORE enrichment, ensuring we don't lose the processing attempt
  console.log(`  📝 [Pipeline] Processing "${scrapedTool.title}" from ${source.name}`);
  // If stage logging is implemented:
  // const stageStart = await logStageStart('NORMALIZE', { tool: scrapedTool.title, url: candidate.url });

  // ===================================================================
  // PHASE: ENRICH — Fetch tool website content for better analysis data
  // ===================================================================
  const { enrichTool } = await import('@/lib/enrichment');
  // ... enrichment logic (unchanged, lines 449-473) ...

  // Clean raw text (unchanged, lines 476-479)
  if (contentSource === 'detail') {
    const cleanedRawText = cleanRawText(detailResult.content);
    scrapedTool.rawText = cleanedRawText;
  }

  // ===================================================================
  // PHASE: NORMALIZE (continued) — Validate content quality
  // ===================================================================
  const validation = validateToolContent(scrapedTool);
  if (!validation.valid) {
    // ... rejection logic (unchanged) ...
  }

  // ===================================================================
  // PHASE: STORE — Insert validated tool into database
  // ===================================================================
  try {
    const insertParams: InsertToolParams = { /* ... unchanged ... */ };
    const inserted = await insertTool(insertParams);
    // ... (unchanged) ...
  } catch (err) {
    // ... (unchanged) ...
  }
}
```

### Step 5: Preserve enrichment error logging

When enrichment fails (both fetch and Jina fallback), log the failure clearly:

```typescript
if (enrichment.content) {
  // ... enrichment success handling ...
} else {
  console.log(`    ⚠️  [Pipeline:ENRICH] Enrichment returned no content for ${scrapedTool.websiteUrl} — continuing with detail page text`);
}
```

### Step 6: Verify the PipelineSummary still accumulates correctly

All counters (`toolsFailed`, `toolsRejected`, `toolsInserted`, `rejectionReasons`, etc.) must remain exactly as they are. Phase reordering must not change any counter logic — only the order in which logging occurs relative to enrichment.

## Security Requirements

- No changes to security boundaries. The pipeline file already imports `'server-only'`.
- No changes to admin secret or credential handling.
- The enrichment import (`await import('@/lib/enrichment')`) remains dynamic to avoid circular dependencies.

## Acceptance Criteria

1. The per-tool processing loop now has named phase comment blocks: `FETCH`, `EXTRACT`, `NORMALIZE`, `ENRICH`, `STORE`.
2. A log entry (console.log or stage log) is emitted **before** the enrichment call for each tool, recording the tool name and source.
3. Enrichment failures still log the failure — they don't silently skip logging.
4. All existing counters (`toolsFailed`, `toolsRejected`, `toolsInserted`, `rejectionReasons`) are unchanged.
5. All existing `console.log` calls are preserved.
6. Pipeline behavior with default options is identical (no regressions).
7. `npm run typecheck` passes with zero errors.
8. `npm run lint` passes with zero new errors.

## Checks to Run

- `npm run typecheck` — TypeScript no-emit
- `npm run lint` — ESLint
- `npm run build` — Next.js production build

## Exact Manual Test Steps

1. Run `npm run dev`.
2. Trigger a manual scrape with an invalid website URL (to force enrichment failure):
   `curl -X POST http://localhost:3000/api/scrape -H "x-devscout-admin-secret: YOUR_SECRET" -H "Content-Type: application/json" -d '{"sourceIds": ["<a-source-uuid>"], "perSourceLimit": 1}'`
3. Watch terminal output. Verify you see the LOG phase message **before** the enrichment attempt:
   - `📝 [Pipeline] Processing "ToolName" from Product Hunt`
   - Then `🔍 [Pipeline] Enriching from tool website: https://...` or `⚠️ [Pipeline:ENRICH] Enrichment returned no content`
4. If enrichment fails, verify you still see the LOG phase message (proving logging happens before enrichment, not after).
5. Verify the pipeline still completes and tools are still inserted.
6. Verify the same with a working website URL — enrichment succeeds, tool is inserted, all phases log correctly.
