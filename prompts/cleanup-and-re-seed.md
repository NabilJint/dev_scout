# Database Cleanup, Re-seed, Fresh Scrape & Analysis

## Goal

Execute a four-step operation to restore DevScout AI to a healthy state with quality developer tools:

1. **Clean house** — Delete all scraped junk tools (blog posts, category pages, consumer products, non-tool links) from Supabase
2. **Re-seed** — Re-insert the 12 quality seed tools (Cursor, Supabase, Clerk, Vercel, Neon, Resend, Prisma, Stripe, PlanetScale, Railway, Coolify, Trigger.dev, Inngest) with their analyses
3. **Scrape fresh** — Run the manual scraping pipeline to discover real new developer tools from active sources
4. **Analyze** — Run AI analysis on all pending tools (seed + scraped) so they appear on the homepage

**Current state:** The Supabase database has ~22 scraped tools that are almost all junk — SaaSHub category pages, Hacker News non-tool links, random GitHub repos, Reddit side projects, Dev.to blog posts, BetaList consumer apps. The 12 original seed tools were lost when scraped data replaced them. The homepage shows 0 quality tools because `analyzedOnly: true` hides everything pending analysis.

## Assigned Specialist Agent(s)

| Step | Specialist | Work |
|------|------------|------|
| 1–2 | **Database Engineer** | Delete junk data, re-run seed script via Supabase Dashboard SQL Editor |
| 3 | **Backend Engineer** | Execute manual scrape via `POST /api/scrape`, watch progress logs |
| 4 | **AI/ML Engineer** | Execute analysis via `POST /api/analyze`, watch progress logs |
| All | **Code Reviewer** | Review any diffs (if code changes are needed) |
| All | **QA Engineer** | Verify typecheck/lint/build, confirm homepage shows real tools |

**Important:** No code changes are expected. This is a data-operations prompt. The implementing agents should run the commands and SQL as specified, not modify source files. If any source file bug is discovered that blocks the pipeline, that should be reported to the Manager for a separate fix prompt.

## Skills Read

- `supabase` — SQL operations (DELETE, INSERT, idempotent seed patterns via ON CONFLICT and WHERE NOT EXISTS)
- Existing `lib/scrape/pipeline.ts` — Understand current pipeline orchestrator, candidate filtering, dedupe, validation integration
- Existing `lib/scrape/validate.ts` — Understand current validation rules (title check, image/date required, article/consumer rejection, body quality threshold)
- Existing `lib/analyze/index.ts` — Understand current analysis pipeline (pending detection via LEFT JOIN, batch processing, Zod validation, upsert)
- Existing `app/api/scrape/route.ts` — Request body format, admin secret header requirement
- Existing `app/api/analyze/route.ts` — Request body format, admin secret header requirement

## Existing Code Inspected

- `supabase/seed-data.sql` — 12 seed tools with ON CONFLICT DO NOTHING idempotency. Tools reference source_ids by listing_url. Analyses check `ta.tool_id is null` to avoid duplicates. All 12 tools have real image URLs from cdn.simpleicons.org and official brand kits (Trigger.dev, Inngest). Categories mapped correctly for filter-pill compatibility.
- `lib/scrape/pipeline.ts` — Pipeline orchestrator that loads sources, extracts candidates, filters non-tool URLs, dedupes, scrapes detail pages with `render: true`, validates with `validateToolContent`, inserts via `insertTool`. Logs progress to console.
- `lib/scrape/validate.ts` — `validateToolContent()` function that rejects generic titles, missing images/dates, short body (<100 chars), article titles ("how to", "guide to", "vs", "in 2024"), consumer patterns (fashion, gaming, beauty, travel), blog/careers/community indicators.
- `lib/analyze/index.ts` — `runAnalysisPipeline()` that calls `getPendingAnalysisTools()` (LEFT JOIN detection via two-step query: get all analyzed tool IDs, then filter tools without analysis), processes in batches of 5 (configurable via `ANALYSIS_BATCH_SIZE`), calls NVIDIA API with retry, validates with Zod, saves via `upsertAnalysis`, sets `analyzed_at`.
- `app/api/scrape/route.ts` — Accepts `{ sourceIds?: string[], perSourceLimit?: number }`. Requires `x-devscout-admin-secret` header. Returns `{ success, summary }`.
- `app/api/analyze/route.ts` — Accepts `{ limit?: number, toolIds?: string[] }`. Requires `x-devscout-admin-secret` header. Returns `{ success, summary }`.
- `docs/agents/memory-log.md` — Dev.to and Reddit r/SideProject sources were deactivated (active = false) on 2026-07-22. Only 5 sources remain active: Product Hunt, Hacker News, GitHub Trending, BetaList, SaaSHub.

## Decisions or Assumptions

1. **Full delete is safest** — Since all 22 scraped tools are junk and the 12 seed tools are the only quality data, deleting everything in `tool_analyses` and `tools` (respecting FK order) is the cleanest approach. No individual junk-pattern matching needed.
2. **Seed is idempotent** — The existing `supabase/seed-data.sql` uses `ON CONFLICT (listing_url) DO NOTHING` for sources, `WHERE NOT EXISTS` for tools, and `ON CONFLICT (tool_id) DO NOTHING` for analyses. After the DELETE, these will insert fresh — no seed file changes needed.
3. **Sources are already seeded** — The 7 tool sources (Product Hunt, Hacker News, GitHub Trending, BetaList, SaaSHub, Dev.to, Reddit r/SideProject) already exist in the DB from previous seed runs. The seed script's source INSERT uses `ON CONFLICT (listing_url) DO NOTHING` so re-running is safe.
4. **Dev.to and Reddit are inactive** — They remain in the DB with `active = false`. The scrape pipeline uses `getActiveSources()` which only returns active sources, so the scrape will only hit the 5 active ones.
5. **Scrape will hit all 5 active sources by default** — The scrape route defaults to `getActiveSources()` when no `sourceIds` are provided. Per AGENTS.md Section 8, default is all active sources.
6. **No code changes required** — This is purely a data operations + API execution task. If bugs are found, report them to the Manager for a separate fix.
7. **Analysis runs on seed + scraped tools together** — `getPendingAnalysisTools()` returns all tools without a `tool_analyses` row, regardless of source. Both seed and newly scraped tools will be analyzed in the same pipeline run.
8. **Homepage only shows analyzed tools** — The home page query uses `analyzedOnly: true` (default). Tools only appear after `analyzed_at` is set. Both seed analyses (re-inserted by the seed) and new analyses (from AI pipeline) will make tools visible.

## Files That May Change

No source code changes are expected for this operation. All steps are data operations (SQL in Supabase Dashboard) and API calls.

If any source file bug is discovered that blocks the pipeline, the affected specialist should report it to the Manager rather than fixing it inline.

| File | Action | Specialist |
|------|--------|------------|
| — | No changes expected | — |

## Implementation Requirements

### Step 1 — Database Cleanup (Database Engineer)

Run the following SQL in **Supabase Dashboard → SQL Editor**. The order matters because `tool_analyses` has a foreign key to `tools`.

```sql
-- Step 1: Clean all scraped data
-- Delete analyses first (FK depends on tools)
DELETE FROM public.tool_analyses;

-- Then delete all tools
DELETE FROM public.tools;

-- Verify both tables are empty
SELECT 'tool_analyses' as tbl, count(*) FROM public.tool_analyses
UNION ALL
SELECT 'tools' as tbl, count(*) FROM public.tools;
```

**Expected result:** Both counts are 0.

Do **not** delete rows from `tool_sources`, `logs`, `oxylabs_schedules`, or `oxylabs_schedule_runs`. Only tools and tool_analyses should be cleaned.

### Step 2 — Re-seed (Database Engineer)

Open `supabase/seed-data.sql` from the project root in the SQL Editor (after the cleanup SQL, or as a separate query).

**Important before running:** Ensure the file path is `supabase/seed-data.sql` — it contains all 12 seed tools and their analyses with real logo URLs from the previous logos-and-seed-data implementation.

Run the full contents of `supabase/seed-data.sql` in Supabase Dashboard → SQL Editor.

After running, verify the seed by executing:

```sql
-- Verify seed data
SELECT 'tool_sources' as tbl, count(*) FROM public.tool_sources
UNION ALL
SELECT 'tools' as tbl, count(*) FROM public.tools
UNION ALL
SELECT 'tool_analyses' as tbl, count(*) FROM public.tool_analyses;

-- List seeded tools
SELECT t.name, ta.category, ta.tool_rating_label, ta.adoption_label
FROM public.tools t
JOIN public.tool_analyses ta ON ta.tool_id = t.id
ORDER BY t.name;
```

**Expected result:**
- `tool_sources`: 7 rows (5 active, 2 inactive)
- `tools`: 12 rows (Cursor, Supabase, Clerk, Vercel, Resend, Prisma, Stripe, PlanetScale, Railway, Coolify, Trigger.dev, Inngest)
- `tool_analyses`: 12 rows (one per tool)
- All 12 tools listed with categories matching filter pills

If `ON CONFLICT` or `WHERE NOT EXISTS` prevented insertion because rows already existed (from a previous seed run that wasn't cleaned), the counts will be wrong. In that case, re-run the DELETE SQL from Step 1 first and then re-run the seed.

### Step 3 — Scrape Fresh (Backend Engineer)

After cleanup and re-seed, trigger the manual scraping pipeline.

**Prerequisites:**
1. The Next.js dev server must be running (`npm run dev`)
2. `DEVSCOUT_ADMIN_SECRET` must be set in `.env.local`
3. Oxylabs credentials (`OXY_WSA_USERNAME`, `OXY_WSA_PASSWORD`) must be set in `.env.local`
4. The 5 active sources (Product Hunt, Hacker News, GitHub Trending, BetaList, SaaSHub) must exist in the DB and be active

**Command:**

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -H "x-devscout-admin-secret: YOUR_DEVSCOUT_ADMIN_SECRET" \
  -d '{}'
```

This uses the defaults: all active sources, up to 5 valid tools per source.

**Optional:** To scrape a specific number of sources and limit:

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -H "x-devscout-admin-secret: YOUR_DEVSCOUT_ADMIN_SECRET" \
  -d '{"sourceIds": ["source-uuid-1", "source-uuid-2", "source-uuid-3"], "perSourceLimit": 5}'
```

But the default (all active sources, 5 per source) is recommended.

**Monitor the dev server terminal** — the pipeline logs detailed progress:
```
📡 [Scrape] Starting scrape for Product Hunt...
  📄 [Scrape] Homepage fetched for Product Hunt (...)
  🔗 [Scrape] Found 30 candidate links on Product Hunt
  ❌ [Scrape] Rejected 25 candidates on Product Hunt (not a tool URL)
  🔍 [Scrape] Checking 5 new candidates...
  📄 [Scrape] Fetching 5 detail pages from Product Hunt...
    ✅ [Scrape] Inserted "ToolName" from Product Hunt
    ❌ [Scrape] Rejected "Non-product title" from Product Hunt (article_page)
    ...
```

**Expected outcome:**
- The pipeline will extract candidate links from each source homepage
- Filter through the parser's `isToolUrl()` check
- Reject non-tool pages (blog, careers, community, etc.)
- Dedupe (within source and against existing DB tools)
- Scrape detail pages with `render: true`
- Clean raw text with `cleanRawText()`
- Validate with `validateToolContent()` — this filters out articles, consumer products, generic pages
- Insert only valid tools

**Target:** ~5 valid tools per source, up to 25 total. Actual results depend on what's trending on each source at the time — 0 new tools from a source is acceptable if nothing passes validation.

**IMPORTANT:** Scraping takes time. Each source homepage fetch + detail page fetches can take 10–30 seconds each due to Oxylabs rendering. The total pipeline may take 2–5 minutes. Wait for the full `📊 [Scrape] Pipeline summary` output before proceeding.

**What the API returns:**
```json
{
  "success": true,
  "summary": {
    "status": "completed",
    "sourcesChecked": 5,
    "sourcesErrored": 0,
    "candidatesFound": 120,
    "candidatesRejected": 95,
    "duplicatesSkipped": 5,
    "detailPagesScraped": 20,
    "toolsInserted": 8,
    "toolsRejected": 12,
    "toolsFailed": 0,
    "totalDuration": "145.3s",
    "rejectionReasons": {
      "article_page": 7,
      "non_tool_page": 3,
      "body_too_short": 2
    }
  }
}
```

### Step 4 — Analyze (AI/ML Engineer)

After scraping completes, trigger the AI analysis pipeline.

**Prerequisites:**
1. `OPENAI_API_KEY` must be set in `.env.local` (points to NVIDIA API with custom base URL)
2. `OPENAI_BASE_URL` may be set (defaults to `https://integrate.api.nvidia.com/v1`)
3. The dev server must still be running
4. The scrape must have completed

**Command:**

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -H "x-devscout-admin-secret: YOUR_DEVSCOUT_ADMIN_SECRET" \
  -d '{}'
```

This analyzes ALL pending tools. The `getPendingAnalysisTools()` function uses LEFT JOIN logic (two-step: get all analyzed tool IDs, then filter tools without analysis). This means:
- The 12 seed tools — they have `tool_analyses` rows from Step 2, so they will be **skipped** (already have analysis)
- Newly scraped tools — they have no `tool_analyses` rows, so they will be **analyzed**

If for some reason seed tools are missing their analysis (e.g., seed didn't insert properly), they will also be picked up.

**Optional — analyze with a limit:**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -H "x-devscout-admin-secret: YOUR_DEVSCOUT_ADMIN_SECRET" \
  -d '{"limit": 10}'
```

But the default (no limit) is recommended to get all pending tools analyzed.

**Monitor the dev server terminal** — the pipeline logs progress:
```
🤖 [Analysis] Starting analysis pipeline...
  📊 [Analysis] Found 8 pending tools to analyze
  📊 Processing batch 1/2: tools 1-5 of 8
  🔍 [Analysis] Analyzing: CoolToolName...
  ✅ [Analysis] Analyzed: CoolToolName (adoption: growing, rating: balanced)
  ...
📊 [Analysis] Pipeline complete: 8 analyzed, 0 failed, 0 skipped (45000ms)
```

**Expected outcome:**
- All newly scraped tools get analyzed
- The analysis uses `minimaxai/minimax-m3` model via NVIDIA API (Vercel AI SDK with custom OpenAI provider)
- Output is validated with Zod schema before saving
- Each analysis includes: summary, adoption score/label, tool rating label, beginner/balanced/power-user percentages, complexity score, confidence, category, main purpose, target users, key features, pros, cons, pricing model, integrations, best for, marketing buzzwords, rating notes, disclaimer
- `analyzed_at` is set on the tool after successful analysis save
- Retry once on failure; mark as failed if both attempts fail

### Final Verification

After all 4 steps are complete:

1. **Check homepage** — Visit `http://localhost:3000/`. You should see tool cards with real logos, AI summaries, scores, and categories. The 12 seed tools should appear immediately (they have pre-computed analyses). Scraped tools appear after their analysis completes.

2. **Check tool details** — Click any tool card to navigate to `/tools/[id]`. You should see full analysis: hero image, score card, key features, pros/cons, pricing, etc.

3. **Check tool count:**
```sql
SELECT count(*) as total_tools FROM public.tools;
SELECT count(*) as total_analyzed FROM public.tools WHERE analyzed_at IS NOT NULL;
SELECT count(*) as total_analyses FROM public.tool_analyses;
```
`total_tools` should be 12 (seed) + number of scraped tools. `total_analyzed` and `total_analyses` should equal `total_tools` (all analyzed).

## Security Requirements

- All API calls (scrape, analyze) must include the `x-devscout-admin-secret` header
- The admin secret must match the `DEVSCOUT_ADMIN_SECRET` environment variable
- No browser-exposed credentials are involved in these steps
- Supabase Dashboard SQL Editor runs with admin privileges — the DELETE SQL will permanently remove data. Double-check before running.

## Acceptance Criteria

1. Old junk tools (22 scraped items) are completely removed from the database
2. 12 seed tools (Cursor, Supabase, Clerk, Vercel, Neon, Resend, Prisma, Stripe, PlanetScale, Railway, Coolify, Trigger.dev, Inngest) are re-inserted with their analyses showing correct categories
3. Fresh scrape produces quality developer tools with images, descriptions, and source references
4. Scraped tools are validated by current `lib/scrape/validate.ts` rules — no blog posts, no consumer products, no category pages, no generic titles
5. AI analysis runs on all pending tools (new scraped tools) and succeeds for valid ones
6. Homepage shows real developer tools with proper cards, AI scores, categories
7. Tool details page at `/tools/[id]` shows full analysis for each tool
8. All checks pass (`typecheck`, `lint`, `build`) — but note: no code changes are expected, so these should already pass

## Checks to Run

- `npm run typecheck` — Verify TypeScript still compiles (no code changes, so should pass)
- `npm run lint` — Verify lint still passes (no code changes, so should pass)
- `npm run build` — Verify production build succeeds (no code changes, so should pass)
- Confirm homepage at `/` shows real analyzed tools with cards, scores, categories
- Confirm tool details at `/tools/[id]` shows full analysis
- Verify seed data count: 12 tools + 12 analyses minimum
- If scraping produced tools, verify those also show on homepage after analysis

## Exact Manual Test Steps

### Before starting
1. Ensure `.env.local` has all required variables: `DEVSCOUT_ADMIN_SECRET`, `OXY_WSA_USERNAME`, `OXY_WSA_PASSWORD`, `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
2. Start the dev server: `npm run dev` — **keep this terminal visible** for pipeline logs
3. Open a **second terminal** for curl commands

### Step 1-2: Clean and re-seed
4. Open Supabase Dashboard → SQL Editor at https://supabase.com/dashboard/project/[PROJECT_ID]/sql/new
5. Run the DELETE SQL:
   ```sql
   DELETE FROM public.tool_analyses;
   DELETE FROM public.tools;
   ```
6. Verify: `SELECT count(*) FROM public.tools;` → 0
7. Open `supabase/seed-data.sql` from the project
8. Copy the entire contents into a new SQL Editor tab
9. Run it
10. Verify: 
    ```sql
    SELECT t.name, ta.category FROM public.tools t
    JOIN public.tool_analyses ta ON ta.tool_id = t.id
    ORDER BY t.name;
    ```
    → 12 rows with correct categories

### Step 3: Scrape
11. In the dev server terminal, watch for logs
12. In the second terminal, run:
    ```bash
    curl -X POST http://localhost:3000/api/scrape \
      -H "Content-Type: application/json" \
      -H "x-devscout-admin-secret: YOUR_SECRET"
    ```
13. Wait for the pipeline to complete (2–5 minutes). Watch the logs in the dev server terminal.
14. Check the API response for the summary object.
15. If the scrape returns errors, investigate and retry. Common issues:
    - Oxylabs credentials wrong → check `.env.local`
    - Network timeout → retry
    - No candidates found → sources may have changed their DOM structure (parser may need updating — report to Manager)

### Step 4: Analyze
16. After scrape completes (or even if it produced 0 tools), run:
    ```bash
    curl -X POST http://localhost:3000/api/analyze \
      -H "Content-Type: application/json" \
      -H "x-devscout-admin-secret: YOUR_SECRET"
    ```
17. Wait for analysis to complete. Watch for analyzed/failed/skipped counts.
18. If seed analyses were also picked up as pending (they shouldn't be since seed inserts them), they'll be analyzed too — this is fine.

### Final verification
19. Visit `http://localhost:3000/` — should show tool cards with real data
20. Click a seed tool card → should show full details page with analysis
21. If scraped tools exist, click one → should show full AI analysis
22. Run checks:
    ```bash
    npm run typecheck
    npm run lint
    npm run build
    ```

## Implementation Order & Handoff

1. **Database Engineer (Steps 1–2):** Clean DB via DELETE SQL, re-run seed SQL. Verify 12 seed tools + 12 analyses exist. Hand off to Backend Engineer.
2. **Backend Engineer (Step 3):** Run scrape via curl. Monitor logs. Note the summary. Hand off to AI/ML Engineer.
3. **AI/ML Engineer (Step 4):** Run analysis via curl. Monitor logs. Note the summary. Hand off to QA Engineer.
4. **QA Engineer:** Run typecheck/lint/build. Verify homepage and details page show real tools. Report results.
5. **Code Reviewer:** Review any diffs (if code changes were made). If no code changes, confirm and note as clean.
6. **Documentation Memory Agent:** Log the outcome to `docs/agents/memory-log.md`.
7. **CEO Assistant:** Compile final report.

## Version Notes

- **Prompt file:** `prompts/cleanup-and-re-seed.md`
- **Prompt Engineer:** DevScout AI Prompt Engineer
- **Date:** 2026-07-22
- **Based on:** AGENTS.md Sections 7–10, 13, 16, 19; existing pipeline code at `lib/scrape/`, `lib/analyze/`, `app/api/scrape/route.ts`, `app/api/analyze/route.ts`
