# Implementation Prompt: Manual Oxylabs Scraping Pipeline for DevScout AI

## Goal

Implement the manual Oxylabs Web Scraper scraping pipeline for DevScout AI — a Next.js 16 (app router) project that scrapes 7 discovery platforms (Product Hunt, Hacker News, GitHub Trending, BetaList, SaaSHub, Dev.to, Reddit r/SideProject) using the Oxylabs Web Scraper API Realtime endpoint, validates and cleans tool content, stores valid tools in Supabase, and exposes a single POST `/api/scrape` API route for manual triggering.

**Note**: This prompt ONLY covers manual scraping. AI analysis (`POST /api/analyze`), Oxylabs Scheduler, and Vercel Cron are NOT included — they are implemented in separate prompts.

---

## Assigned Specialist Agent(s)

| Agent | Role |
|-------|------|
| **Backend Engineer** (primary) | Implements all modules — all `lib/scrape/` logic, the POST `/api/scrape` route |
| **Security Engineer** | Reviews admin secret handling, approves Oxylabs credential handling |
| **Performance Engineer** | Reviews batching, timeout handling, retry/backoff in Oxylabs client and pipeline |
| **Code Reviewer** | Reviews all diffs before merge |
| **QA Engineer** | Runs `typecheck`, `lint`, `build`; provides test commands |

---

## Skills Read

- `.agents/skills/oxylabs-web-scraper` — Oxylabs Web Scraper API endpoint, authentication (HTTP Basic Auth), parameters (`source`, `url`, `render`, `geo_location`, `user_agent_type`), response structure, error codes (401, 403, 429), retry/backoff guidance
- `.agents/skills/supabase` — Supabase client creation, service role usage, query patterns, joined table filter gotcha
- `node_modules/next/dist/docs/` — Next.js 16 API route patterns, route handlers, edge runtime vs Node.js runtime

---

## Existing Code Inspected

| File | Key Findings |
|------|--------------|
| `lib/supabase/types.ts` | All TypeScript types defined: `Tool`, `ToolSource`, `ToolAnalysis`, `Log` — plus all insert/update param types |
| `lib/supabase/client.ts` | `createServerClient()` (service role for writes) and `createServerReadOnlyClient()` (anon key for reads) — both existing and tested |
| `lib/supabase/queries/sources.ts` | `getActiveSources()`, `getSourceById()`, `getSourceByListingUrl()` — all exist |
| `lib/supabase/queries/tools.ts` | `insertTool()`, `insertTools()`, `checkToolsExistByOriginalUrls()` (chunks of 15), `updateToolAnalyzedAt()` — all exist |
| `lib/supabase/queries/logs.ts` | `insertLog()`, `logInfo()`, `logWarn()`, `logError()` — all exist |
| `lib/supabase/queries/index.ts` | Barrel file exports all query modules |
| `supabase/schema.sql` | Core tables: `tool_sources`, `tools`, `tool_analyses`, `logs` — all with RLS, indexes, constraints |
| `supabase/seed.sql` | 7 active sources seeded: Product Hunt (parser_strategy=`producthunt`), Hacker News (`hackernews`), GitHub Trending (`github-trending`), BetaList (`betalist`), SaaSHub (`saashub`), Dev.to (`devto`), Reddit r/SideProject (`reddit`) |
| `.env.local` | Has `OXY_WSA_USERNAME`, `OXY_WSA_PASSWORD`, `DEVSCOUT_ADMIN_SECRET` — all set |
| `package.json` | No Cheerio dependency (needs to be added for HTML parsing) |
| `AGENTS.md` | Full rules in sections 7-17, 21 — scrape-to-insert pipeline (section 9), non-tool-page reject list, tool validation rules (section 13), admin secret rule (section 15), environment variable table (section 21) |

---

## Decisions / Assumptions

1. **Cheerio for HTML parsing**: The project uses Cheerio for server-side HTML parsing. Add `cheerio` to dependencies. Do NOT use JSDOM or other parsers.
2. **Oxylabs for all scraping**: All HTTP fetches for homepage listing pages AND tool detail pages go through Oxylabs `universal` source. Direct `fetch()` is never used for scraping.
3. **`universal` source with `render: "html"` for JS-heavy sites**: Use `source: "universal"` for all URLs. Add `render: "html"` for JavaScript-heavy sites (Product Hunt is the primary one; Reddit may also need it). Other sources may work without render.
4. **Realtime API (`POST https://realtime.oxylabs.io/v1/queries`)**: Use the Realtime API for ALL scraping calls (homepage listing pages and tool detail pages). The Push-Pull API is only needed for the Scheduler feature (handled in a separate prompt).
5. **`.env.example` must be updated**: With `OXY_WSA_USERNAME`, `OXY_WSA_PASSWORD`, `DEVSCOUT_ADMIN_SECRET` entries.
6. **No AI analysis in this prompt**: Analysis comes in a separate prompt.
7. **Parser strategy mapping**: The `parser_strategy` field on `tool_sources` maps to parser names in `lib/scrape/parsers/index.ts`. The seed data already has correct strategy names.
8. **Retry/backoff**: 429 errors get retry up to 3 times with exponential backoff (1s, 2s, 4s). 401/403 errors fail immediately.
9. **All pipeline modules in `server-only`**: The entire `lib/scrape/` directory is server-only code. Never import it in client components or client API routes.

---

## Files Likely to Change

| File | Action |
|------|--------|
| `lib/scrape/oxylabs.ts` | **New** — Oxylabs API client |
| `lib/scrape/types.ts` | **New** — Pipeline types (CandidateLink, ScrapedTool, PipelineSummary) |
| `lib/scrape/validate.ts` | **New** — Tool validation & raw_text cleanup |
| `lib/scrape/pipeline.ts` | **New** — Main scrape-to-insert pipeline orchestrator |
| `lib/scrape/middleware.ts` | **New** — Admin secret verification helper |
| `lib/scrape/parsers/index.ts` | **New** — Barrel file + parser registry |
| `lib/scrape/parsers/hackernews.ts` | **New** — Hacker News parser |
| `lib/scrape/parsers/github-trending.ts` | **New** — GitHub Trending parser |
| `lib/scrape/parsers/producthunt.ts` | **New** — Product Hunt parser |
| `lib/scrape/parsers/betalist.ts` | **New** — BetaList parser |
| `lib/scrape/parsers/saashub.ts` | **New** — SaaSHub parser |
| `lib/scrape/parsers/devto.ts` | **New** — Dev.to parser |
| `lib/scrape/parsers/reddit.ts` | **New** — Reddit r/SideProject parser |
| `app/api/scrape/route.ts` | **New** — POST /api/scrape |
| `.env.example` | **Update** — Add new env vars |
| `package.json` | **Update** — Add `cheerio` dependency |

---

## Implementation Requirements

### Module 0: Project Setup

#### 0.1 Install Dependencies

```bash
npm install cheerio
```

#### 0.2 Update `.env.example`

Add to `.env.example`:
```env
# Oxylabs Web Scraper API
OXY_WSA_USERNAME=
OXY_WSA_PASSWORD=

# Shared admin secret for action API routes
DEVSCOUT_ADMIN_SECRET=
```

---

### Module 1: Scraping Engine (`lib/scrape/`)

#### 1.1 `lib/scrape/types.ts`

Create shared types for the scraping pipeline:

```typescript
export interface CandidateLink {
  url: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ScrapedTool {
  title: string;
  description: string;
  imageUrl: string;
  lastUpdated: string;   // ISO date string
  rawText: string;
}

export interface PipelineSummary {
  status: 'completed' | 'failed' | 'partial';
  sourcesChecked: number;
  candidatesFound: number;
  candidatesRejected: number;
  duplicatesSkipped: number;
  detailPagesScraped: number;
  toolsInserted: number;
  toolsRejected: number;
  toolsFailed: number;
  totalDuration: string;   // human-readable like "3.2s" or "45.1s"
  rejectionReasons: Record<string, number>;  // reason -> count
}

export interface Parser {
  /** Display name of this parser/source */
  name: string;
  /** Check if a URL looks like a real tool listing page for this source */
  isToolUrl(url: string): boolean;
  /** Extract candidate links from the homepage listing HTML */
  extractCandidates(html: string): CandidateLink[];
  /** Extract tool details from a tool detail page HTML */
  extractToolContent(html: string): ScrapedTool | null;
}
```

#### 1.2 `lib/scrape/oxylabs.ts` — Oxylabs API Client

Create an Oxylabs API client with the following behavior:

- **Base URL**: `https://realtime.oxylabs.io/v1/queries`
- **Auth**: HTTP Basic Auth using `OXY_WSA_USERNAME` and `OXY_WSA_PASSWORD` from env
- **Function**: `scrapeUrl(url: string, options?: { render?: boolean }): Promise<{ content: string; statusCode: number; error?: string }>`
- Uses `source: "universal"` for all URLs
- Adds `render: "html"` when `options.render` is true
- **Error handling**:
  - 401/403: Fail immediately with descriptive error (invalid credentials / access denied)
  - 429: Retry with exponential backoff (1s, 2s, 4s) up to 3 retries. Log each retry with `console.warn`
  - Other 4xx/5xx: Return error message, do not crash
  - Network errors: Retry once after 3s
- **Response parsing**: Extract `results[0].content` (the HTML string) and `results[0].status_code`
- Wrap in `try/catch` returning `{ content: '', statusCode: 0, error: string }` on failure

Implementation pattern:
```typescript
export async function scrapeUrl(
  url: string,
  options?: { render?: boolean }
): Promise<{ content: string; statusCode: number; error?: string }> {
  const username = process.env.OXY_WSA_USERNAME;
  const password = process.env.OXY_WSA_PASSWORD;

  if (!username || !password) {
    return { content: '', statusCode: 0, error: 'OXY_WSA_USERNAME or OXY_WSA_PASSWORD not set' };
  }

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  const maxRetries = 3;
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const body: Record<string, unknown> = { source: 'universal', url };
      if (options?.render) {
        body.render = 'html';
      }

      const response = await fetch('https://realtime.oxylabs.io/v1/queries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 401) {
        return { content: '', statusCode: 401, error: 'Oxylabs authentication failed (401)' };
      }
      if (response.status === 403) {
        return { content: '', statusCode: 403, error: 'Oxylabs access denied (403)' };
      }

      if (response.status === 429) {
        lastError = `Rate limited (429) on attempt ${attempt + 1}`;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`  ⚠️  ${lastError}, retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return { content: '', statusCode: 429, error: lastError };
      }

      if (!response.ok) {
        return { content: '', statusCode: response.status, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      const result = data?.results?.[0];

      if (!result) {
        return { content: '', statusCode: 0, error: 'No results in Oxylabs response' };
      }

      return {
        content: typeof result.content === 'string' ? result.content : '',
        statusCode: result.status_code || 200,
      };

    } catch (err) {
      lastError = `Network error: ${err instanceof Error ? err.message : String(err)}`;
      if (attempt < maxRetries) {
        console.warn(`  ⚠️  ${lastError}, retrying in 3s...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  return { content: '', statusCode: 0, error: lastError || 'Unknown error' };
}
```

#### 1.3 `lib/scrape/parsers/` — Source-Specific Parsers

Each parser file exports an object of type `Parser` (from `types.ts`). All parsers use **Cheerio** for HTML parsing.

**General rules for all parsers:**
- `isToolUrl(url)`: Return `true` only if the URL looks like a real tool/product page. Return `false` for anything on the **non-tool-page reject list** (AGENTS.md section 9): blog, changelog, category/directory listings, author bios, search pages, navigation/menu/footer links, status/uptime pages, careers/jobs, community/forum pages, comparison/review/"alternatives to" pages, corporate/media-kit pages, newsletter/subscription pages, login/signup/dashboard pages. When uncertain, return `false`.
- `extractCandidates(html)`: Extract only visible product/feature card links from the homepage. Return `CandidateLink[]`. Each must have at minimum `url` and `title`.
- `extractToolContent(html)`: Parse a tool detail page. Return `ScrapedTool` or `null` if parsing fails. Fields:
  - `title`: extracted product title
  - `description`: brief description or og:description
  - `imageUrl`: Open Graph image, first product image, or null — use `og:image` meta tag first, then fall back to other images
  - `lastUpdated`: date string — try to find a "last updated" date, or use `meta[property="article:published_time"]`, or use current date as fallback
  - `rawText`: cleaned page text (scripts, styles, nav removed)

**Parse order of precedence for `lastUpdated`:**
1. Look for explicit "Last updated" / "Updated" date text on the page
2. `<meta property="article:published_time" content="...">`
3. `<meta name="date" content="...">`
4. `<time>` element with datetime attribute
5. Fallback to `new Date().toISOString()` — this is acceptable since we're scraping the page now

**Parse order of precedence for `imageUrl`:**
1. `<meta property="og:image" content="...">`
2. `<meta name="twitter:image" content="...">`
3. First `<img>` with meaningful size (>100px) that's not a logo/icon/avatar
4. Fallback to empty string (validation will reject tools without image)

##### 1.3.1 Hacker News (`parsers/hackernews.ts`)

- Strategy: `hackernews`
- Homepage: `https://news.ycombinator.com`
- **extractCandidates**: Parse `.athing` rows. Each row has `td.title a` (story link) and `td.title .sitestr` (domain). Extract title from `a` text, URL from `a` href. Use `.subtext .score` for points, `.subtext a` for comments count. Store points in `metadata.points` and comments in `metadata.comments`.
- **isToolUrl**: URL should look like an external tool, not `news.ycombinator.com/*` internal page. Must have an external http(s) URL (not a HN item page). Accept URLs from common tool domains.
- **extractToolContent**: Fetch the tool URL itself (not the HN discussion page). Parse the tool's page HTML. For the tool detail page, extract Open Graph data, title, description, image.

##### 1.3.2 GitHub Trending (`parsers/github-trending.ts`)

- Strategy: `github-trending`
- Homepage: `https://github.com/trending`
- **extractCandidates**: Parse `article.Box-row` entries. Extract repo name from `h2.h3 a` (the `href` is `/org/repo`), description from `p.col-9`, language from `.d-inline-block` (first occurrence), stars from `a.Link--muted` (last link in the row stats area). Build full GitHub URL `https://github.com/org/repo`.
- **isToolUrl**: Must match `github.com/<owner>/<repo>` format.
- **extractToolContent**: Fetch `https://github.com/org/repo` page. Extract description from `article.BorderGrid` (the "About" section) or README content. Image can be the repo's social preview (`meta[property="og:image"]`). Last updated from the repo metadata.

##### 1.3.3 Product Hunt (`parsers/producthunt.ts`)

- Strategy: `producthunt`
- Homepage: `https://producthunt.com`
- **extractCandidates**: Parse post cards from the homepage or "recent" section. Product Hunt is JavaScript-heavy — will need `render: "html"`. Extract: product name, tagline, upvotes, comment count, product URL (`/posts/*`). Build full URL `https://producthunt.com/posts/<slug>`.
- **isToolUrl**: Must match `producthunt.com/posts/*` format. Reject if it's a user profile, collection, topic, or question page.
- **extractToolContent**: Fetch `https://producthunt.com/posts/<slug>` with rendering enabled. Extract from the page content: product name, description/tagline, website URL (the actual tool URL), image (first product screenshot or og:image), maker info, launch date as `lastUpdated`.

##### 1.3.4 BetaList (`parsers/betalist.ts`)

- Strategy: `betalist`
- Homepage: `https://betalist.com`
- **extractCandidates**: Parse startup cards on `betalist.com`. Extract startup name, tagline, launch date, URL (path like `/startups/<slug>`). Build full URL.
- **isToolUrl**: Must match `betalist.com/startups/*` format.
- **extractToolContent**: Fetch the startup page. Extract name, description, image (logo/screenshot), launch date as `lastUpdated`.

##### 1.3.5 SaaSHub (`parsers/saashub.ts`)

- Strategy: `saashub`
- Homepage: `https://saashub.com`
- **extractCandidates**: Parse directory entries. Extract product name, description, pricing info, category, URL (like `/products/<slug>`). Build full URL.
- **isToolUrl**: Must match `saashub.com/*` format where `*` is a product detail path, not a category/directory listing. Reject category pages like `/categories/*` or `/`.
- **extractToolContent**: Fetch the product detail page. Extract name, description, pricing, features, image.

##### 1.3.6 Dev.to (`parsers/devto.ts`)

- Strategy: `devto`
- Homepage: `https://dev.to`
- **extractCandidates**: Parse article cards. Each card has title, description, tags, URL (like `/<username>/<article-slug>`). Build full URL `https://dev.to/<username>/<slug>`. Only extract articles relevant to developer tools (check tags for tool-related keywords like "showdev", "opensource", "tooling", "productivity").
- **isToolUrl**: Must match `dev.to/*/*` format (username/article). Should be a tool showcase or review, not a general programming tutorial.
- **extractToolContent**: Fetch the article page. Extract canonical URL, description, tags, published date as `lastUpdated`, cover image as `imageUrl`.

##### 1.3.7 Reddit r/SideProject (`parsers/reddit.ts`)

- Strategy: `reddit`
- Homepage: `https://reddit.com/r/SideProject`
- **extractCandidates**: Parse post cards. Each shows title, URL (external link or Reddit self post), upvotes, comment count. Extract external URLs (preferred) or Reddit comments URL.
- **isToolUrl**: Accept external URLs that point to actual tool/product pages (not social media, not another Reddit thread). For self posts, accept `reddit.com/r/SideProject/comments/*` only if the post has enough content to be useful.
- **extractToolContent**: For external URLs, fetch that page directly. For self posts, parse the Reddit post content. Extract title, post body as description, posted date as `lastUpdated`, any media/image links.

##### 1.3.8 Parser Registry (`parsers/index.ts`)

Barrel file that exports all parsers and a registry function:

```typescript
import { Parser } from '../types';
import { hackernewsParser } from './hackernews';
import { githubTrendingParser } from './github-trending';
import { producthuntParser } from './producthunt';
import { betalistParser } from './betalist';
import { saashubParser } from './saashub';
import { devtoParser } from './devto';
import { redditParser } from './reddit';

const parsers: Record<string, Parser> = {
  hackernews: hackernewsParser,
  'github-trending': githubTrendingParser,
  producthunt: producthuntParser,
  betalist: betalistParser,
  saashub: saashubParser,
  devto: devtoParser,
  reddit: redditParser,
};

export function getParser(strategy: string): Parser | undefined {
  return parsers[strategy];
}

export { Parser } from '../types';
```

#### 1.4 `lib/scrape/validate.ts` — Tool Validation & Cleanup

Per AGENTS.md Section 13 rules.

**`cleanRawText(html: string): string`**
- Load HTML with Cheerio
- Remove: `<script>`, `<style>`, `<nav>`, `<footer>`, `<header>`, cookie-consent banners, newsletter/subscription blocks, testimonial-carousel repeated markup, "trusted by" logo-strip text, chat-widget scripts, social share buttons/text, repeated navigation labels
- Remove: inline event handlers (`onclick`, `onload`, etc.), CSS class dumps (gibberish class names)
- Remove: JSON-LD script content, meta tags content dump
- Extract meaningful text from `<body>` or `<main>` or `<article>` — prefer article content
- Clean up: reduce multiple blank lines to one, trim whitespace
- Return cleaned text — should read like a product description, not a webpage dump

**`validateToolContent(content: ScrapedTool): { valid: boolean; reason?: string }`**

Accept only if:
- `content.title` is present and not generic (not "Home", "Blog", "Careers", "Community", "Docs", "Pricing", "About", "Contact", "Sign In", "Dashboard", etc.)
- `content.imageUrl` is present and non-empty — **required** (per AGENTS.md Section 13: "image URL is required")
- `content.lastUpdated` is present and non-empty — **required** (per AGENTS.md Section 13: "last-updated date is required")
- `content.rawText` passes body quality check (see below)
- Content has one clear product subject (not a blog, listing, careers, community, or corporate page)

**Body quality check** — passes if EITHER:
- 3 or more meaningful paragraphs (`\n\n` or `<p>` splits) with at least 30 chars each, OR
- 900 or more meaningful characters after cleanup, AND a clear product-specific title, AND an image URL, AND a last-updated date

If text extraction returns one large paragraph, split it using page DOM blocks or sentence boundaries before validation.

**Rejection reasons** (return as `reason` string):
- `title_generic` — title is generic or non-product
- `missing_image` — no image URL
- `missing_last_updated` — no last-updated date
- `body_too_short` — fewer than 3 paragraphs and fewer than 900 chars
- `body_low_quality` — body is mostly unrelated content
- `not_a_product_page` — page type doesn't look like a product (blog, careers, community, etc.)

#### 1.5 `lib/scrape/pipeline.ts` — Pipeline Orchestrator

The main function `runScrapePipeline` orchestrates the entire scrape-to-insert flow per AGENTS.md Section 9.

**Signature:**
```typescript
import { ToolSource } from '@/lib/supabase/types';
import { PipelineSummary } from './types';

export async function runScrapePipeline(
  sources: ToolSource[],
  options?: { perSourceLimit?: number }
): Promise<PipelineSummary>
```

**Flow per source:**

1. **Determine parser**: Look up `source.parser_strategy` in the parser registry. Skip source if no parser found (log warning).

2. **Determine if render is needed**: Hardcode a set of source names that need JavaScript rendering:
   ```typescript
   const needsRender = new Set(['producthunt', 'reddit']);
   ```
   (Product Hunt is JS-heavy; Reddit may need it for proper card extraction)

3. **Scrape homepage**: Call `scrapeUrl(source.listing_url, { render: needsRender.has(strategy) })`. If error, log error, increment source errors, continue to next source.

4. **Extract candidates**: Call `parser.extractCandidates(html)` to get `CandidateLink[]`. Log count found.

5. **Reject non-tool URLs**: Filter candidates:
   - Apply `parser.isToolUrl(candidate.url)` — reject if false
   - Apply the **non-tool-page reject list** from AGENTS.md: reject if URL matches blog, changelog, category/directory listing, author/team bio, search, nav/menu/footer, status/uptime, careers/jobs, community/forum, comparison/review/alternatives, corporate/media-kit, newsletter/subscription, login/signup/dashboard patterns
   - Count rejections by reason
   - If `perSourceLimit` is provided, limit remaining candidates to that number

6. **Normalize and dedupe URLs**:
   - Normalize: strip trailing slashes, ensure https://
   - Dedupe within the source's candidate list (by URL)
   - Count `duplicatesSkipped`

7. **Check existing in Supabase**: Call `checkToolsExistByOriginalUrls(urls)` (already handles chunks of 15). Filter out existing URLs. Count as `duplicatesSkipped`.

8. **Scrape tool detail pages**: For each remaining candidate URL:
   - Call `scrapeUrl(url, { render: true })` — always use render for detail pages to get complete content
   - If error, log and increment `toolsFailed`
   - Call `parser.extractToolContent(html)` to get `ScrapedTool | null`
   - If null, log and increment `toolsFailed`

9. **Validate**: Call `validateToolContent(scrapedTool)`. If invalid, log reason and increment `toolsRejected` with the reason in `rejectionReasons`.

10. **Insert**: If valid, call `insertTool(...)` with mapped parameters. Increment `toolsInserted`.

11. **Logging throughout**: Use `console.log` with neat messages:
    ```
    📡 [Scrape] Starting scrape for <source.name>...
    📄 [Scrape] Homepage fetched for <source.name> (<listing_url>)
    🔗 [Scrape] Found <N> candidate links on <source.name>
    ❌ [Scrape] Rejected <N> candidates on <source.name> (<reason>)
    🔁 [Scrape] Skipped <N> duplicates on <source.name>
    ✅ [Scrape] Inserted <N> new tools from <source.name>
    ❌ [Scrape] Rejected <N> tools (validation) from <source.name>
    ❌ [Scrape] Failed to scrape <N> detail pages from <source.name>
    ⚠️  [Scrape] Error on <source.name>: <error message>
    ```

12. **Return summary**: Build and return `PipelineSummary` with aggregate counts and per-rejection-reason counts. Track total duration with `performance.now()`.

**Edge cases:**
- Empty sources list: return summary with status "completed" and all zeroes
- All sources fail: return status "partial" with sourcesChecked > 0 but everything else zero
- Single source fails, others succeed: status "partial"
- Everything succeeds: status "completed"

**Timeout consideration**: Each scrape call is a network fetch. For 7 sources with 5 detail pages each, that's ~7 + 35 = 42 Oxylabs calls. Each call may take 2-10s. Total could be 2-7 minutes. That's acceptable for a serverless function on Vercel (max 300s or 900s on Pro). No need to split into sub-pipelines for now.

---

### Module 2: API Route (`app/api/scrape/route.ts`)

#### 2.1 `POST /api/scrape` — Manual Scraping Trigger

Route handler for manual scraping trigger.

```typescript
// app/api/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getActiveSources, getSourceById } from '@/lib/supabase/queries/sources';
import { runScrapePipeline } from '@/lib/scrape/pipeline';
import { verifyAdminSecret } from '@/lib/scrape/middleware';

export async function POST(request: NextRequest) {
  // 1. Verify admin secret
  const auth = verifyAdminSecret(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  // 2. Parse body
  const body = await request.json().catch(() => ({}));
  const { sourceIds, perSourceLimit } = body as {
    sourceIds?: string[];
    perSourceLimit?: number;
  };

  // 3. Select sources
  let sources;
  if (sourceIds && sourceIds.length > 0) {
    const results = await Promise.all(sourceIds.map(id => getSourceById(id)));
    sources = results.filter(Boolean);
    // TypeScript narrowing
    sources = sources.filter(s => s !== null);
  } else {
    sources = await getActiveSources();
  }

  if (sources.length === 0) {
    return NextResponse.json({
      success: true,
      summary: {
        status: 'completed',
        sourcesChecked: 0,
        candidatesFound: 0,
        candidatesRejected: 0,
        duplicatesSkipped: 0,
        detailPagesScraped: 0,
        toolsInserted: 0,
        toolsRejected: 0,
        toolsFailed: 0,
        totalDuration: '0ms',
        rejectionReasons: {},
      },
    });
  }

  // 4. Run pipeline
  try {
    const summary = await runScrapePipeline(sources, { perSourceLimit });
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    console.error('[Scrape] Pipeline error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

**Request body:**
```json
{
  "sourceIds": ["uuid1", "uuid2"],  // optional
  "perSourceLimit": 5                // optional, default 5
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "status": "completed",
    "sourcesChecked": 3,
    "candidatesFound": 45,
    "candidatesRejected": 12,
    "duplicatesSkipped": 8,
    "detailPagesScraped": 25,
    "toolsInserted": 5,
    "toolsRejected": 15,
    "toolsFailed": 5,
    "totalDuration": "45.2s",
    "rejectionReasons": {
      "missing_image": 8,
      "title_generic": 4,
      "body_too_short": 3
    }
  }
}
```

---

### Module 3: Security (`lib/scrape/middleware.ts`)

#### 3.1 Admin Secret Verification

```typescript
// lib/scrape/middleware.ts
import { NextRequest } from 'next/server';

export function verifyAdminSecret(request: NextRequest): { valid: boolean; error?: string } {
  const secret = request.headers.get('x-devscout-admin-secret');
  const expected = process.env.DEVSCOUT_ADMIN_SECRET;

  if (!expected) {
    console.error('[Security] DEVSCOUT_ADMIN_SECRET environment variable is not set');
    return { valid: false, error: 'Server configuration error' };
  }

  if (!secret) {
    return { valid: false, error: 'Missing x-devscout-admin-secret header' };
  }

  if (secret !== expected) {
    return { valid: false, error: 'Invalid admin secret' };
  }

  return { valid: true };
}
```

---

## Security Requirements

- [ ] `OXY_WSA_USERNAME` and `OXY_WSA_PASSWORD` are server-only env vars — never exposed to browser
- [ ] `DEVSCOUT_ADMIN_SECRET` is server-only — never in URL query strings, never in browser code
- [ ] `POST /api/scrape` requires `x-devscout-admin-secret` header
- [ ] Missing or invalid admin secret returns `401` with JSON error
- [ ] Never run Oxylabs calls, scraping, or pipeline logic from browser code
- [ ] All `lib/scrape/` modules are server-only — never imported in client components
- [ ] `.env.example` documents all env vars without exposing real values
- [ ] **Security Engineer** must review all credential handling before implementation is considered done

---

## Acceptance Criteria

- [ ] `lib/scrape/oxylabs.ts` — Oxylabs API client with HTTP Basic Auth, 429 retry/backoff, 401/403 fail-fast
- [ ] `lib/scrape/types.ts` — `CandidateLink`, `ScrapedTool`, `PipelineSummary`, `Parser` interfaces defined
- [ ] `lib/scrape/validate.ts` — `cleanRawText()` strips scripts/styles/nav/banners; `validateToolContent()` enforces Section 13 rules
- [ ] `lib/scrape/parsers/` — 7 parsers, each with `isToolUrl`, `extractCandidates`, `extractToolContent`
- [ ] `lib/scrape/parsers/index.ts` — barrel file with `getParser(strategy)` registry
- [ ] `lib/scrape/pipeline.ts` — `runScrapePipeline(sources, options)` orchestrates full flow per Section 9, logs progress, returns `PipelineSummary`
- [ ] `lib/scrape/middleware.ts` — `verifyAdminSecret()` helper
- [ ] `POST /api/scrape` — triggers manual scrape, returns summary
- [ ] `.env.example` — updated with `OXY_WSA_USERNAME`, `OXY_WSA_PASSWORD`, `DEVSCOUT_ADMIN_SECRET`
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

### Test 1: Manual Scraping (with curl)

**Prerequisites**: Ensure `.env.local` has valid `OXY_WSA_USERNAME`, `OXY_WSA_PASSWORD`, and `DEVSCOUT_ADMIN_SECRET`.

```bash
# Start dev server in one terminal
npm run dev

# In another terminal, trigger manual scrape of 2 sources with 3 tools each
curl -X POST http://localhost:3000/api/scrape \
  -H 'Content-Type: application/json' \
  -H 'x-devscout-admin-secret: YOUR_ADMIN_SECRET' \
  -d '{
    "sourceIds": ["source-uuid-1", "source-uuid-2"],
    "perSourceLimit": 3
  }'
```

**Watch the dev server terminal** — you should see neat console logs:
```
📡 [Scrape] Starting scrape for Hacker News...
📄 [Scrape] Homepage fetched for Hacker News (https://news.ycombinator.com)
🔗 [Scrape] Found 30 candidate links on Hacker News
❌ [Scrape] Rejected 15 candidates on Hacker News (not a tool URL)
🔁 [Scrape] Skipped 0 duplicates on Hacker News
📄 [Scrape] Fetching detail page: https://example-tool.com...
✅ [Scrape] Inserted "Example Tool" from Hacker News
...
📊 [Scrape] Pipeline summary: { "status": "completed", "toolsInserted": 5, ... }
```

**Expected response:**
```json
{
  "success": true,
  "summary": {
    "status": "completed",
    "sourcesChecked": 2,
    "candidatesFound": 45,
    "candidatesRejected": 20,
    "duplicatesSkipped": 5,
    "detailPagesScraped": 20,
    "toolsInserted": 3,
    "toolsRejected": 12,
    "toolsFailed": 5,
    "totalDuration": "45.2s",
    "rejectionReasons": {
      "missing_image": 6,
      "body_too_short": 4,
      "title_generic": 2
    }
  }
}
```

### Test 2: Missing Admin Secret

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H 'Content-Type: application/json'
```

**Expected**: `401` with `{ "success": false, "error": "Missing x-devscout-admin-secret header" }`

### Test 3: Invalid Admin Secret

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H 'Content-Type: application/json' \
  -H 'x-devscout-admin-secret: WRONG_SECRET'
```

**Expected**: `401` with `{ "success": false, "error": "Invalid admin secret" }`

### Test 4: Scrape All Active Sources (default)

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H 'Content-Type: application/json' \
  -H 'x-devscout-admin-secret: YOUR_ADMIN_SECRET'
```

**Expected**: Scrapes all 7 active sources with default limit of 5 per source. Returns full summary.

### Test 5: Verify Data in Supabase

After scraping, check Supabase Dashboard → Table Editor → `tools` table for inserted records. Each tool should have:
- `original_url` — unique URL of the tool page
- `name` — extracted tool name
- `image_url` — non-empty
- `last_updated` — non-null date
- `raw_text` — cleaned product description text
- `scraped_at` — timestamp of when it was scraped
- `analyzed_at` — should be `null` (analysis comes later)

### Test 6: Verify Logs

```bash
curl -X GET 'http://localhost:3000/api/logs' \
  -H 'x-devscout-admin-secret: YOUR_ADMIN_SECRET' \
  -H 'Content-Type: application/json'
```

**Expected**: Log entries from the scrape run with `level: "info"`, message containing scrape summary.

---

## Handoff Notes

- **Backend Engineer** implements all modules (`lib/scrape/` and `app/api/scrape/route.ts`)
- **Security Engineer** reviews `lib/scrape/middleware.ts` and credential handling
- **Performance Engineer** reviews Oxylabs retry/backoff, pipeline batching (42 calls per full scrape = acceptable), timeout handling
- **Code Reviewer** reviews all diffs — check for: server-only imports, no secret exposure, error handling completeness
- **QA Engineer** runs `typecheck`, `lint`, `build` and reports exact output; confirms the 6 test steps above
- **Documentation Memory Agent** logs outcome to `docs/agents/memory-log.md`
- **CEO Assistant** compiles final report

## Next Steps After This Prompt

1. AI analysis pipeline (separate prompt — implements `POST /api/analyze` and `lib/analyze/`)
2. Oxylabs Scheduler + Vercel Cron (separate prompt — automated hourly scraping)
3. pgvector + related tools (separate prompt — after AI analysis is working)

---

*Prompt created by Prompt Engineer for Backend Engineer, Security Engineer, Performance Engineer, Code Reviewer, and QA Engineer implementation*
