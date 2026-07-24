# Implementation Prompt: Tool Enrichment Pipeline for DevScout AI

## Goal

Implement the tool enrichment pipeline for DevScout AI — a complete re-architecture of how tool content is acquired. Replace the current practice of scraping tool **detail pages** via Oxylabs (expensive, low-quality source page content) with a hybrid approach: use Oxylabs **only for source homepage discovery**, then enrich tool content from the actual tool website using free methods (direct `fetch()` + Cheerio, with Jina AI Reader fallback).

**Core insight**: Most developer tool websites (cursor.com, supabase.com, vercel.com, prisma.io, clerk.com) are server-rendered marketing pages that respond to standard HTTP `fetch()` with proper headers. They do not require Oxylabs' anti-bot rendering. This eliminates 50–85% of Oxylabs detail page calls while producing higher-quality content for AI analysis.

---

## Assigned Specialist Agent(s)

| Agent | Role |
|-------|------|
| **Database Engineer** (primary) | Schema changes — ALTER TABLE, update `schema.sql`, `types.ts` |
| **Backend Engineer** (primary) | Enrichment module (5 files), parser updates, pipeline integration, `POST /api/enrich` |
| **Frontend Engineer** | Homepage filter by `curation_status`, tool card URL fix |
| **Security Engineer** | Reviews that enrichment uses NO credentials, validates SSRF protections |
| **Code Reviewer** | Reviews all diffs before merge |
| **QA Engineer** | Runs `typecheck`, `lint`, `build`; provides test commands |

---

## Skills Read

- `.agents/skills/supabase` — ALTER TABLE patterns, service role usage, query patterns
- `node_modules/next/dist/docs/` — Next.js 16 API route patterns, route handlers

---

## Existing Code Inspected

| File | Key Findings |
|------|--------------|
| `lib/scrape/types.ts` | `CandidateLink` already has `websiteUrl?: string` field. `ScrapedTool` already has `websiteUrl?: string \| null` field. Both exist from previous implementation. |
| `lib/scrape/pipeline.ts` | Full pipeline orchestrator in `runScrapePipeline()`. Inserts tools with `InsertToolParams` (no `website_url` or `curation_status` yet). |
| `lib/scrape/validate.ts` | `cleanRawText()` and `validateToolContent()` both exist with full Section 13 rules. |
| `lib/scrape/parsers/` | 7 parsers exist. Product Hunt already extracts `websiteUrl` but doesn't pass it through to `ScrapedTool`. HackerNews candidate URL IS the tool URL. GitHub Trending doesn't extract homepage URL. |
| `lib/supabase/types.ts` | `Tool`, `InsertToolParams`, `ToolWithSource`, `ToolWithAnalysis` all defined. No `website_url` or `curation_status` yet. Database type defined. |
| `lib/supabase/queries/tools.ts` | `insertTool()`, `insertTools()`, `getTools()`, `updateToolRawText()`, `checkToolsExistByOriginalUrls()` all exist. |
| `lib/supabase/queries/analyses.ts` | `upsertAnalysis()`, `updateAnalysis()` exist. |
| `supabase/schema.sql` | 6 tables defined. `tools` table has no `website_url` or `curation_status` columns. `tool_analyses` has `embedding vector(1536)` as commented-out ALTER TABLE. |
| `supabase/seed-data.sql` | 12 seed tools with rich content. All use `original_url` = tool website URL (e.g., `https://cursor.com`). No `website_url` column yet. |
| `app/page.tsx` | Fetches tools with `analyzedOnly: true`. No `curationStatus` filter. |
| `components/tool-card.tsx` | Card links to `/tools/${tool.id}`. Uses `image_url` for logo display. |
| `lib/analyze/index.ts` | AI analysis pipeline with batch processing, LEFT JOIN pending detection, `updateToolAnalyzedAt()`. |
| `app/api/analyze/route.ts` | `POST /api/analyze` with Zod validation, admin secret check. |
| `app/api/scrape/route.ts` | `POST /api/scrape` with Zod validation, admin secret check. |
| `lib/scrape/middleware.ts` | `verifyAdminSecret()` — timing-safe comparison. |
| `docs/architecture/adr-003-website-url-and-curation-status.md` | ADR for adding `website_url` and `curation_status` columns. Uses `pending` as default — not `auto-suggested`. |
| `docs/architecture/adr-005-simpleicons-logo-enrichment.md` | ADR for SimpleIcons logo resolution (3-tier). |
| `docs/architecture/adr-006-zero-oxylabs-enrichment.md` | ADR for zero-Oxylabs enrichment architecture. |

---

## Decisions / Assumptions

1. **Schema default `curation_status`**: The CEO specification says `'auto-suggested'` as default. The ADR-003 says `'pending'`. Use **`'auto-suggested'`** per the CEO's approved spec. The ADR will be updated to match.
2. **Enrichment is best-effort, never blocking**: If enrichment fails (website unreachable, timeouts, no content), the tool is still inserted with whatever content was extracted from the source page. The `curation_status = 'auto-suggested'` regardless.
3. **Seed tools get `curation_status = 'curated'`**: The 12 seed tools are hand-curated, verified quality. They should always appear on the homepage.
4. **Homepage only shows `curated` and `reviewed` tools**: Auto-suggested tools are hidden from the homepage until reviewed by an admin.
5. **Jina AI Reader is free, no API key**: The Jina fallback at `https://r.jina.ai/{url}` requires no authentication. No env var needed.
6. **No `.env.example` changes**: Jina requires no credentials. No new env vars introduced.
7. **Logo enrichment is part of the enrichment module — always runs**: Even if content enrichment fails, logo resolution runs. A valid logo can upgrade a tool even without website content.
8. **Rate limiting**: 500ms delay between direct fetches to avoid being rate-limited by target websites.
9. **Timeout**: All external fetches have a 10-second timeout via `AbortController`.
10. **`website_url` is NOT used for deduplication in this phase**: Deduplication still uses `original_url`. `website_url` is for display and enrichment only. Cross-source deduplication by website URL is future work.

---

## Files Likely to Change

| File | Action |
|------|--------|
| `supabase/schema.sql` | **Update** — Add `website_url` and `curation_status` columns to `tools` table |
| `lib/supabase/types.ts` | **Update** — Add `website_url`, `curation_status` to `Tool`, `InsertToolParams`; add `curation_status` filter to `GetToolsParams` |
| `lib/enrichment/types.ts` | **New** — `EnrichedContent`, `LogoResult` interfaces |
| `lib/enrichment/resolve-website.ts` | **New** — Direct fetch + Cheerio enrichment |
| `lib/enrichment/jina-fallback.ts` | **New** — Jina AI Reader fallback |
| `lib/enrichment/logo-resolver.ts` | **New** — 3-tier logo resolution |
| `lib/enrichment/index.ts` | **New** — Orchestrator (`enrichTool()`) |
| `lib/scrape/types.ts` | **No changes needed** — `websiteUrl` already exists on both `CandidateLink` and `ScrapedTool` |
| `lib/scrape/parsers/hackernews.ts` | **Update** — Set `websiteUrl` on `ScrapedTool` to the candidate URL (it IS the tool URL) |
| `lib/scrape/parsers/producthunt.ts` | **Update** — Pass extracted `websiteUrl` through on `ScrapedTool` |
| `lib/scrape/parsers/github-trending.ts` | **Update** — Try to extract homepage URL from GitHub repo page |
| `lib/scrape/parsers/betalist.ts` | **Update** — Extract and pass through `websiteUrl` |
| `lib/scrape/parsers/saashub.ts` | **Update** — Extract and pass through `websiteUrl` |
| `lib/scrape/parsers/devto.ts` | **Update** — Pass through `websiteUrl` if available |
| `lib/scrape/parsers/reddit.ts` | **Update** — Pass through `websiteUrl` if available (external link URLs) |
| `lib/scrape/pipeline.ts` | **Update** — Add enrichment step after detail page extraction; insert with `website_url`, `curation_status` |
| `supabase/seed-data.sql` | **Update** — Add `website_url` and `curation_status` to 12 seed tools |
| `app/page.tsx` | **Update** — Filter by `curation_status` |
| `lib/supabase/queries/tools.ts` | **Update** — Add `curationStatus` filter param to `getTools()` |
| `app/api/enrich/route.ts` | **New** — POST /api/enrich backfill endpoint |
| `lib/enrichment/sources.ts` | **New** — Helper to fetch enrichment data for specific tools |

---

## Implementation Requirements

### Module 0: Schema Changes (Database Engineer)

#### 0.1 ALTER TABLE SQL

Run in Supabase Dashboard → SQL Editor:

```sql
-- Add website_url column (nullable, not unique — cross-source dedupe is future work)
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Add curation_status column
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS curation_status TEXT NOT NULL DEFAULT 'auto-suggested';

-- Add check constraint for curation_status
ALTER TABLE public.tools ADD CONSTRAINT IF NOT EXISTS chk_curation_status 
  CHECK (curation_status IN ('curated', 'reviewed', 'auto-suggested', 'rejected'));

-- Index for homepage filtering
CREATE INDEX IF NOT EXISTS idx_tools_curation_status ON public.tools (curation_status)
  WHERE curation_status IN ('curated', 'reviewed');
```

#### 0.2 Update `supabase/schema.sql`

Add the ALTER TABLE statements (or inline column definitions) to the `tools` table definition in `supabase/schema.sql`. Update the CREATE TABLE to include the new columns:

```sql
create table if not exists public.tools (
    id uuid primary key default gen_random_uuid(),
    source_id uuid not null references public.tool_sources(id) on delete cascade,
    original_url text not null unique,
    canonical_url text not null,
    name text not null,
    brand_text text,
    image_url text not null,
    last_updated timestamptz not null,
    raw_text text,
    website_url text,                                          -- NEW
    curation_status text not null default 'auto-suggested',     -- NEW
    constraint chk_curation_status check (curation_status in ('curated', 'reviewed', 'auto-suggested', 'rejected')),  -- NEW
    scraped_at timestamptz not null default now(),
    analyzed_at timestamptz,
    created_at timestamptz not null default now()
);
```

Also add the index in the indexes section:
```sql
create index if not exists idx_tools_curation_status on public.tools (curation_status) 
  where curation_status in ('curated', 'reviewed');
```

#### 0.3 Update `lib/supabase/types.ts`

Add fields to the `Tool` interface:
```typescript
export interface Tool {
  // ... existing fields ...
  website_url?: string | null;   // NEW
  curation_status: string;       // NEW — 'curated' | 'reviewed' | 'auto-suggested' | 'rejected'
  // ... existing fields ...
}
```

Add `website_url` and `curation_status` to `InsertToolParams`:
```typescript
export interface InsertToolParams {
  // ... existing fields ...
  website_url?: string | null;      // NEW
  curation_status?: string;         // NEW — optional, defaults to 'auto-suggested'
  // ... existing fields ...
}
```

Add `curationStatus` to `GetToolsParams`:
```typescript
export interface GetToolsParams {
  limit?: number;
  offset?: number;
  sourceId?: string;
  analyzedOnly?: boolean;
  category?: string;
  curationStatus?: string[];    // NEW — e.g. ['curated', 'reviewed']
}
```

Update the `Database` type's `tools` table definition — add the new columns to Row, Insert, and Update types.

---

### Module 1: Enrichment Module (`lib/enrichment/`)

All files in `lib/enrichment/` are **server-only**. Add `import 'server-only';` at the top of each file.

#### 1.1 `lib/enrichment/types.ts`

```typescript
export interface EnrichedContent {
  websiteUrl: string;             // The actual tool website URL
  title: string;                  // Page title
  description: string;            // Meta description
  ogImage: string | null;         // Open Graph image
  rawText: string;                // Cleaned body text (for AI analysis)
  source: 'direct-fetch' | 'jina-reader' | 'failed';
}

export interface LogoResult {
  logoUrl: string | null;
  source: 'simpleicons' | 'og-image' | 'favicon' | 'none';
}

export interface EnrichmentResult {
  content: EnrichedContent | null;
  logo: LogoResult;
}
```

#### 1.2 `lib/enrichment/resolve-website.ts`

Create `fetchWebsite(url: string): Promise<EnrichedContent | null>`:

```typescript
import 'server-only';
import * as cheerio from 'cheerio';
import type { EnrichedContent } from './types';

const FETCH_TIMEOUT = 10_000; // 10 seconds
const MIN_CONTENT_BYTES = 500; // SPA shells return < 500 bytes

/**
 * Fetch a tool's website URL via direct HTTP and extract rich content.
 * Falls back to null (triggering Jina fallback) on failure.
 */
export async function fetchWebsite(url: string): Promise<EnrichedContent | null> {
  try {
    // Validate URL to prevent SSRF
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      console.warn(`  ⚠️  [Enrichment] Invalid protocol for URL: ${url}`);
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DevScoutAI/1.0; +https://devscout.ai)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`  ⚠️  [Enrichment] HTTP ${response.status} for ${url}`);
      return null;
    }

    const html = await response.text();

    // Reject SPA shells (empty or near-empty content)
    if (html.trim().length < MIN_CONTENT_BYTES) {
      console.warn(`  ⚠️  [Enrichment] Response too short (${html.length} bytes) for ${url} — SPA shell?`);
      return null;
    }

    return parseHtml(html, url);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn(`  ⏱️  [Enrichment] Timeout fetching ${url}`);
    } else {
      console.warn(`  ⚠️  [Enrichment] Fetch error for ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
    return null;
  }
}

function parseHtml(html: string, url: string): EnrichedContent {
  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('title').first().text().trim() ||
    '';

  const description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    '';

  const ogImage =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    null;

  // Clean raw text using the same approach as lib/scrape/validate.ts
  const rawText = cleanRawText($);

  return {
    websiteUrl: url,
    title,
    description,
    ogImage,
    rawText,
    source: 'direct-fetch',
  };
}

/**
 * Clean raw HTML text — removes scripts, styles, nav, banners, etc.
 * Reuses the same logic pattern from lib/scrape/validate.ts.
 */
function cleanRawText($: cheerio.CheerioAPI): string {
  // Remove non-content elements
  $('script, style, iframe, noscript, svg, canvas').remove();
  $('nav, footer, header, .nav, .navbar, .navigation, .menu, .sidebar').remove();
  $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();
  $('[class*="cookie"], [class*="consent"], [class*="privacy"], [class*="gdpr"]').remove();
  $('[id*="cookie"], [id*="consent"], [id*="privacy"]').remove();
  $('[class*="newsletter"], [class*="subscribe"], [class*="signup"], [class*="mailing"]').remove();
  $('[class*="testimonial"], [class*="carousel"], [class*="trusted"], [class*="testimonials"]').remove();
  $('[class*="chat"], [class*="intercom"], [class*="livechat"], [class*="crisp"]').remove();
  $('[class*="share"], [class*="social"], [class*="follow"]').remove();
  $('[class*="comment"], [id*="comment"], .comments, #comments').remove();
  $('script[type="application/ld+json"]').remove();
  $('script[type="application/json"]').remove();

  // Extract main content
  const mainSelectors = 'article, main, [role="main"], .content, #content, .post-content, .readme, .repository-content';
  const mainEl = $(mainSelectors).first();
  let text = mainEl.length ? mainEl.text() : $('body').text();

  // Clean whitespace
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}
```

#### 1.3 `lib/enrichment/jina-fallback.ts`

Create `fetchViaJina(url: string): Promise<EnrichedContent | null>`:

```typescript
import 'server-only';
import type { EnrichedContent } from './types';

const JINA_TIMEOUT = 15_000; // 15 seconds (Jina can be slower)

/**
 * Fallback enrichment via Jina AI Reader (r.jina.ai).
 * Handles JS-only SPAs and bot-blocking websites that reject direct fetch().
 * Jina returns markdown — parse it for title, description, and body text.
 */
export async function fetchViaJina(url: string): Promise<EnrichedContent | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }

    const jinaUrl = `https://r.jina.ai/${encodeURI(url)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), JINA_TIMEOUT);

    const response = await fetch(jinaUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/plain, text/markdown, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; DevScoutAI/1.0; +https://devscout.ai)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`  ⚠️  [Jina] HTTP ${response.status} for ${url}`);
      return null;
    }

    const text = await response.text();

    if (!text || text.trim().length < 100) {
      console.warn(`  ⚠️  [Jina] Empty or too-short response for ${url}`);
      return null;
    }

    // Jina returns markdown. Extract title from first heading, or metadata
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const title = lines.find(l => l.startsWith('# '))?.replace(/^# /, '') || '';
    // Use first meaningful paragraph as description
    const firstPara = lines.find(l => l.length > 50 && !l.startsWith('#') && !l.startsWith('>')) || '';
    const description = firstPara.length > 200 ? firstPara.slice(0, 200) + '...' : firstPara;

    return {
      websiteUrl: url,
      title,
      description,
      ogImage: null, // Jina returns markdown, not OG metadata
      rawText: text,
      source: 'jina-reader',
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn(`  ⏱️  [Jina] Timeout for ${url}`);
    } else {
      console.warn(`  ⚠️  [Jina] Error for ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
    return null;
  }
}
```

#### 1.4 `lib/enrichment/logo-resolver.ts`

Create `resolveLogo(toolName: string, websiteUrl: string): Promise<LogoResult>`:

```typescript
import 'server-only';
import type { LogoResult } from './types';

const SIMPLEICONS_BASE = 'https://cdn.simpleicons.org';

/**
 * Normalize a tool name for SimpleIcons lookup:
 * - Lowercase
 * - Remove non-alphanumeric characters
 * - Remove leading digits
 *
 * Examples:
 *   "Cursor" -> "cursor"
 *   "PlanetScale" -> "planetscale"
 *   "Trigger.dev" -> "triggerdev"
 *   "Supabase" -> "supabase"
 */
function normalizeForSimpleIcons(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^[0-9]+/, '');
}

/**
 * Three-tier logo resolution:
 *
 * Tier 1: SimpleIcons (cdn.simpleicons.org/{name}) — HEAD request, if 200, use it.
 *   Handles both single-word names ("cursor") and multi-word hyphenated ("planetscale").
 *
 * Tier 2: SimpleIcons with hyphenated multi-word name ("cursor" vs "c-l-e-a-n" isn't a thing,
 *   but "visualstudio" and "visual-studio" are different).
 *   Try the original name with spaces replaced by hyphens.
 *
 * Tier 3: Favicon — try {websiteUrl}/favicon.ico
 *
 * Returns null if none work.
 */
export async function resolveLogo(
  toolName: string,
  websiteUrl: string
): Promise<LogoResult> {
  // ---- Tier 1: SimpleIcons (basic name) ----
  const basicName = normalizeForSimpleIcons(toolName);
  if (basicName) {
    const url = `${SIMPLEICONS_BASE}/${basicName}`;
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return { logoUrl: url, source: 'simpleicons' };
      }
    } catch {
      // Network error — continue to next tier
    }
  }

  // ---- Tier 2: SimpleIcons (hyphenated multi-word) ----
  // Some SimpleIcons entries use hyphens for multi-word names
  // e.g., "visual-studio-code", "google-chrome"
  const hyphenated = toolName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  if (hyphenated && hyphenated !== basicName) {
    const url = `${SIMPLEICONS_BASE}/${hyphenated}`;
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return { logoUrl: url, source: 'simpleicons' };
      }
    } catch {
      // Network error — continue to next tier
    }
  }

  // ---- Tier 3: Favicon ----
  if (websiteUrl) {
    try {
      const parsed = new URL(websiteUrl);
      const faviconUrl = `${parsed.origin}/favicon.ico`;
      const response = await fetch(faviconUrl, { method: 'HEAD' });
      if (response.ok) {
        return { logoUrl: faviconUrl, source: 'favicon' };
      }
    } catch {
      // Network error — return null
    }
  }

  return { logoUrl: null, source: 'none' };
}
```

#### 1.5 `lib/enrichment/index.ts`

Create the main orchestrator `enrichTool()`:

```typescript
import 'server-only';

import { fetchWebsite } from './resolve-website';
import { fetchViaJina } from './jina-fallback';
import { resolveLogo } from './logo-resolver';
import type { EnrichmentResult } from './types';

export type { EnrichedContent, LogoResult, EnrichmentResult } from './types';

/**
 * Enrich a tool by fetching its actual website content and resolving its logo.
 *
 * Strategy:
 * 1. Try direct HTTP fetch + Cheerio (primary, ~96% coverage for dev tools)
 * 2. Fall back to Jina AI Reader (handles JS-only SPAs, free)
 * 3. Always try to resolve a brand logo
 *
 * Never throws — returns { content: null, logo: { logoUrl: null, source: 'none' } } on failure.
 *
 * @param tool — Object with `name` and `websiteUrl`
 * @returns EnrichmentResult with content and logo
 */
export async function enrichTool(
  tool: { name: string; websiteUrl: string }
): Promise<EnrichmentResult> {
  const { name, websiteUrl } = tool;

  console.log(`  📦 [Enrichment] Enriching "${name}" from ${websiteUrl}...`);

  // ---- Step 1: Fetch website content ----
  let content = await fetchWebsite(websiteUrl);

  if (!content) {
    // Fall back to Jina
    console.log(`  🔄 [Enrichment] Direct fetch failed for "${name}", trying Jina fallback...`);
    content = await fetchViaJina(websiteUrl);
  }

  if (content) {
    console.log(`  ✅ [Enrichment] Content fetched for "${name}" (source: ${content.source})`);
  } else {
    console.log(`  ⚠️  [Enrichment] All fetch methods failed for "${name}"`);
  }

  // ---- Step 2: Resolve logo (always runs) ----
  const logo = await resolveLogo(name, websiteUrl);

  if (logo.logoUrl) {
    console.log(`  🖼️  [Enrichment] Logo resolved for "${name}" (source: ${logo.source})`);
  } else {
    console.log(`  ℹ️  [Enrichment] No logo resolved for "${name}"`);
  }

  return { content, logo };
}
```

---

### Module 2: Parser Updates (Backend Engineer)

#### 2.1 `lib/scrape/parsers/hackernews.ts`

The candidate URL from Hacker News **IS** the external tool URL. When `extractToolContent()` returns a `ScrapedTool`, include the original URL as `websiteUrl`.

**Change**: In `extractToolContent()`, accept and pass through a `candidateUrl` parameter (or use the URL that was fetched). The `ScrapedTool` already has `websiteUrl?: string | null`. Set it to the candidate's URL (the external URL, not the HN discussion page).

The cleanest approach: modify `extractToolContent` to accept an optional context parameter, or set `websiteUrl` in the pipeline after extraction. Pipeline approach is simpler — see section 3.2.

**Alternative (preferred)**: The pipeline already has access to `candidate.url` when calling `extractToolContent()`. The pipeline will handle `websiteUrl` mapping. For parsers where the `candidate.url` IS the tool URL (Hacker News, Reddit external links, Dev.to), the pipeline enrichment step checks `candidate.websiteUrl || candidate.url`.

#### 2.2 `lib/scrape/parsers/producthunt.ts`

The Product Hunt parser already extracts `websiteUrl` in `extractToolContent()` (line 156-158):
```typescript
const websiteUrl =
  $('a[class*="website"], a[data-test="product-url"]').attr('href') ||
  $('a:contains("Visit")').attr('href') || '';
```

**Change**: Return `websiteUrl` as part of `ScrapedTool`:
```typescript
return {
  title,
  description,
  imageUrl,
  lastUpdated,
  rawText,
  websiteUrl: websiteUrl || null,  // ADD THIS
};
```

#### 2.3 `lib/scrape/parsers/github-trending.ts`

Add homepage URL extraction from the GitHub repo page. After fetching the repo page HTML, extract the homepage link.

**Change**: In `extractToolContent()`, add:
```typescript
// Extract homepage URL from GitHub repo page
// GitHub repos often have a homepage link in the sidebar or repo metadata
const homepageUrl =
  $('a[data-testid="homepage-link"], a[rel="nofollow"]').attr('href') ||
  $('[class*="homepage"] a').attr('href') ||
  '';

return {
  title,
  description,
  imageUrl,
  lastUpdated,
  rawText,
  websiteUrl: homepageUrl || null,  // ADD THIS — null means the pipeline uses the GitHub URL
};
```

#### 2.4 Other parsers (`betalist.ts`, `saashub.ts`, `devto.ts`, `reddit.ts`)

For each parser where `websiteUrl` can be extracted from the detail page, add it to the returned `ScrapedTool`:

- **BetaList**: Look for a "Visit Website" link or external link on the startup page.
  ```typescript
  const websiteUrl =
    $('a:contains("Visit"), a[class*="website"], a[class*="external"]').attr('href') || '';
  ```

- **SaaSHub**: Look for the product website link.
  ```typescript
  const websiteUrl =
    $('a[class*="website"], a[class*="visit"], a:contains("Visit")').attr('href') || '';
  ```

- **Dev.to**: If it's a link post (external URL article), extract the canonical URL or the linked URL.
  ```typescript
  const websiteUrl =
    $('meta[property="og:url"]').attr('content') ||
    $('link[rel="canonical"]').attr('href') || '';
  ```

- **Reddit**: For external link posts, the `candidate.url` IS the tool URL after unwrapping `out.reddit.com` redirects (already done in parser). Pass it through.

All parsers should set `websiteUrl` on the `ScrapedTool` to the actual tool website when detectable.

---

### Module 3: Pipeline Integration (Backend Engineer)

#### 3.1 Update `lib/scrape/types.ts`

**No changes needed** — both `CandidateLink.websiteUrl` and `ScrapedTool.websiteUrl` already exist.

#### 3.2 Update `lib/scrape/pipeline.ts`

Add enrichment after detail page extraction and before insertion. This is the core integration point.

**Changes needed in the tool-processing loop** (after `scrapedTool` is extracted and validated, around line 340):

```typescript
// ---- After validation, before insertion ----

// ---- Determine website URL for enrichment ----
// Priority: 1. ScrapedTool.websiteUrl (from parser), 2. CandidateLink.websiteUrl, 3. candidate.url
const websiteUrl = scrapedTool.websiteUrl || candidate.websiteUrl || candidate.url;

// ---- Run enrichment from actual tool website ----
let enrichedImageUrl: string | null = null;
let enrichedRawText: string | null = null;

if (websiteUrl && websiteUrl !== candidate.url) {
  // Only enrich if we have a distinct tool website URL
  // (no point enriching if websiteUrl == candidate.url — that's the same page)
  const enrichment = await enrichTool({ name: scrapedTool.title, websiteUrl });

  if (enrichment.content) {
    enrichedRawText = enrichment.content.rawText;
    console.log(`    📦 [Enrichment] Replaced raw_text with enriched content from ${websiteUrl}`);
  }

  if (enrichment.logo.logoUrl) {
    enrichedImageUrl = enrichment.logo.logoUrl;
    console.log(`    🖼️  [Enrichment] Using resolved logo: ${enrichment.logo.logoUrl}`);
  }
} else {
  console.log(`    ℹ️  [Enrichment] Skipping — website URL matches candidate URL (${candidate.url})`);
}
```

Then update the `insertTool()` call to include the new fields:

```typescript
const insertParams: InsertToolParams = {
  source_id: source.id,
  original_url: candidate.url,
  canonical_url: candidate.url,
  name: scrapedTool.title,
  brand_text: null,
  image_url: enrichedImageUrl || scrapedTool.imageUrl,  // Enriched logo takes priority
  last_updated: scrapedTool.lastUpdated,
  raw_text: enrichedRawText || scrapedTool.rawText,      // Enriched content takes priority
  website_url: websiteUrl,                                // NEW
  curation_status: 'auto-suggested',                      // NEW — all scraped tools start as auto-suggested
};
```

**Edge cases:**
- Enrichment failure → `enrichedRawText` stays null → uses original `scrapedTool.rawText`
- No logo resolved → `enrichedImageUrl` stays null → uses original `scrapedTool.imageUrl`
- `websiteUrl` equals `candidate.url` → skip enrichment (no point fetching the same page again)
- Website fetch returns no content → tool still inserted with whatever content exists

**Add imports at the top of pipeline.ts:**
```typescript
import { enrichTool } from '@/lib/enrichment';
```

---

### Module 4: Seed Data Backfill (Database Engineer / Backend Engineer)

#### 4.1 Update `supabase/seed-data.sql`

The 12 seed tools already use `original_url` = tool website URL (e.g., `https://cursor.com`). Add the two new columns:

1. Add `website_url` column to the INSERT — set it to the same value as `original_url` (since seed tools already use the actual website URL).
2. Add `curation_status` column — set to `'curated'` for all 12 seed tools.

Update the INSERT section of `seed-data.sql`:

```sql
with source_ids as (
    select id, listing_url from public.tool_sources
),
tool_insert as (
    insert into public.tools (
        source_id,
        original_url,
        canonical_url,
        name,
        brand_text,
        image_url,
        last_updated,
        raw_text,
        website_url,           -- NEW
        curation_status,       -- NEW
        analyzed_at
    )
    -- ... each tool now includes:
    --   website_url = 'https://cursor.com',
    --   curation_status = 'curated',
    ...
```

All 12 tools should set:
- `website_url = original_url` (e.g., `'https://cursor.com'`)
- `curation_status = 'curated'`

---

### Module 5: Homepage Display (Frontend Engineer)

#### 5.1 Update `lib/supabase/queries/tools.ts`

Add `curationStatus` filter support to `getTools()`:

```typescript
export async function getTools(params: GetToolsParams = {}): Promise<ToolWithAnalysis[]> {
  const { limit = 50, offset = 0, sourceId, analyzedOnly = true, category, curationStatus } = params;
  const supabase = await createServerReadOnlyClient();

  let query = supabase
    .from('tools')
    .select(`
      *,
      tool_sources (*),
      tool_analyses (*)
    `)
    .order('last_updated', { ascending: false })
    .range(offset, offset + limit - 1);

  if (sourceId) {
    query = query.eq('source_id', sourceId);
  }

  if (analyzedOnly) {
    query = query.not('analyzed_at', 'is', null);
  }

  if (curationStatus && curationStatus.length > 0) {
    // Supabase supports .in() for array filtering
    query = query.in('curation_status', curationStatus);
  }

  // ... rest remains the same
}
```

**Important**: Use `.in('curation_status', curationStatus)` — this is a direct column filter, not a joined table filter, so it works correctly with supabase-js (no PostgREST gotcha).

Also add an `updateToolEnrichment()` function for the backfill route:

```typescript
export async function updateToolEnrichment(
  id: string,
  updates: { website_url?: string | null; raw_text?: string | null; image_url?: string }
): Promise<Tool> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('tools')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
    .overrideTypes<Tool, { merge: false }>();

  if (error) {
    console.error('Error updating tool enrichment:', error);
    throw new Error(`Failed to update tool enrichment: ${error.message}`);
  }

  return data as Tool;
}
```

#### 5.2 Update `app/page.tsx`

Add the `curationStatus` filter to the `getTools()` call:

```typescript
// Fetch analyzed tools that are curated or reviewed
let tools: ToolWithAnalysis[] = [];
try {
  tools = await getTools({
    analyzedOnly: true,
    limit: 50,
    curationStatus: ['curated', 'reviewed'],  // NEW — only show curated/reviewed tools
  }) as unknown as ToolWithAnalysis[];
  // ...
} catch (err) {
  // ...
}
```

This ensures that auto-suggested tools (from scraping) don't appear on the homepage until an admin reviews them.

#### 5.3 Tool Card URL (optional enhancement)

The tool card currently links to `/tools/${tool.id}` (the details page). No change needed — the details page already shows `website_url` in the metadata section if available.

If desired, the "Visit Website" button on the details page should use `website_url` if available, falling back to `original_url`.

---

### Module 6: Post-Enrichment Backfill API (Backend Engineer)

#### 6.1 `app/api/enrich/route.ts`

Create a `POST /api/enrich` endpoint that runs enrichment on existing tools missing `website_url`:

```typescript
// app/api/enrich/route.ts
// POST /api/enrich — Backfill enrichment on existing tools missing website_url.
// Requires x-devscout-admin-secret header.
// Optionally accepts { toolIds?: string[], limit?: number }.
// Processes tools in batches, updates their website_url, raw_text, and image_url.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminSecret } from '@/lib/scrape/middleware';
import { createServerClient } from '@/lib/supabase/client';
import { enrichTool } from '@/lib/enrichment';
import type { Tool } from '@/lib/supabase/types';

const EnrichRequestBody = z.object({
  toolIds: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(50).optional(),
});

export async function POST(request: NextRequest) {
  const auth = verifyAdminSecret(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = EnrichRequestBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body. Expected { toolIds?: string[], limit?: number }' },
      { status: 400 }
    );
  }

  const { toolIds, limit } = parsed.data;

  try {
    const supabase = await createServerClient();

    // Fetch tools missing website_url
    let query = supabase
      .from('tools')
      .select('id, name, original_url, website_url, image_url, raw_text')
      .is('website_url', null)
      .order('scraped_at', { ascending: false });

    if (toolIds && toolIds.length > 0) {
      query = query.in('id', toolIds);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data: tools, error } = await query.overrideTypes<
      Pick<Tool, 'id' | 'name' | 'original_url' | 'website_url' | 'image_url' | 'raw_text'>[],
      { merge: false }
    >();

    if (error) {
      console.error('[Enrich] Error fetching tools:', error);
      return NextResponse.json(
        { success: false, error: `Failed to fetch tools: ${error.message}` },
        { status: 500 }
      );
    }

    if (!tools || tools.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          checked: 0,
          enriched: 0,
          failed: 0,
          skipped: 0,
          message: 'No tools missing website_url found',
        },
      });
    }

    console.log(`[Enrich] Found ${tools.length} tools missing website_url`);
    let enriched = 0;
    let failed = 0;
    let skipped = 0;
    const details: Array<{ id: string; name: string; status: string }> = [];

    for (const tool of tools) {
      // Use original_url as the website URL (many seed tools already use actual URLs)
      const websiteUrl = tool.original_url;
      if (!websiteUrl) {
        skipped++;
        details.push({ id: tool.id, name: tool.name, status: 'skipped' });
        continue;
      }

      console.log(`  📦 [Enrich] Enriching "${tool.name}" from ${websiteUrl}...`);
      const result = await enrichTool({ name: tool.name, websiteUrl });

      const updates: Record<string, unknown> = {
        website_url: websiteUrl,
      };

      if (result.content) {
        updates.raw_text = result.content.rawText;
        console.log(`    ✅ [Enrich] Content enriched for "${tool.name}"`);
      }

      if (result.logo.logoUrl) {
        updates.image_url = result.logo.logoUrl;
        console.log(`    🖼️  [Enrich] Logo resolved for "${tool.name}": ${result.logo.logoUrl}`);
      }

      try {
        const { error: updateError } = await supabase
          .from('tools')
          .update(updates)
          .eq('id', tool.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        enriched++;
        details.push({ id: tool.id, name: tool.name, status: 'enriched' });
        console.log(`    ✅ [Enrich] Updated "${tool.name}"`);
      } catch (updateErr) {
        failed++;
        details.push({
          id: tool.id,
          name: tool.name,
          status: 'failed',
        });
        console.error(`    ❌ [Enrich] Failed to update "${tool.name}": ${updateErr}`);
      }

      // 500ms delay between tools to be polite
      await new Promise(r => setTimeout(r, 500));
    }

    return NextResponse.json({
      success: true,
      summary: {
        checked: tools.length,
        enriched,
        failed,
        skipped,
        details,
      },
    });
  } catch (err) {
    console.error('[Enrich] Pipeline error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

---

## Security Requirements

- [ ] Enrichment module uses **NO credentials** — no API keys for fetch(), Jina, or SimpleIcons
- [ ] `POST /api/enrich` requires `x-devscout-admin-secret` header (reuses `verifyAdminSecret`)
- [ ] URL validation before fetch: reject non-http(s) protocols to prevent SSRF
- [ ] Timeout on all external fetches: 10s for direct fetch, 15s for Jina
- [ ] All `lib/enrichment/` modules are `server-only` — never imported in client components
- [ ] `website_url` is validated via `new URL()` before any fetch occurs
- [ ] Redirects are followed (Node.js `fetch()` default) but capped at browser-default 20
- [ ] No `.env.example` changes needed — enrichment requires no new secrets
- [ ] **Security Engineer** reviews all enrichment fetch logic before implementation is considered done

---

## Acceptance Criteria

- [ ] `website_url` and `curation_status` columns exist on `public.tools` table
- [ ] `supabase/schema.sql` and `lib/supabase/types.ts` updated with new fields
- [ ] `lib/enrichment/types.ts` — `EnrichedContent`, `LogoResult`, `EnrichmentResult` interfaces defined
- [ ] `lib/enrichment/resolve-website.ts` — `fetchWebsite()` fetches via direct HTTP, parses with Cheerio, returns rich content
- [ ] `lib/enrichment/jina-fallback.ts` — `fetchViaJina()` calls `https://r.jina.ai/{url}`, parses markdown
- [ ] `lib/enrichment/logo-resolver.ts` — `resolveLogo()` tries 3 tiers (SimpleIcons×2, favicon)
- [ ] `lib/enrichment/index.ts` — `enrichTool()` orchestrates content + logo, never throws
- [ ] Product Hunt parser passes `websiteUrl` through in `ScrapedTool`
- [ ] GitHub Trending parser extracts homepage URL from repo page
- [ ] Pipeline integrates enrichment: replaces `raw_text` + `image_url` with enriched content when available
- [ ] Pipeline inserts with `website_url` and `curation_status = 'auto-suggested'`
- [ ] Enrichment failure does NOT block tool insertion — tool saved with original content
- [ ] 12 seed tools updated with `website_url` and `curation_status = 'curated'`
- [ ] Homepage filters by `curationStatus: ['curated', 'reviewed']`
- [ ] `POST /api/enrich` enriches existing tools missing `website_url`
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

# 3. Production build (since schema, queries, and routes changed)
npm run build

# 4. Start dev server for testing
npm run dev
```

---

## Exact Manual Test Steps

After implementation, the implementing specialist shares these exact steps:

### Test 1: Verify Enrichment Works (Unit Test)

Start the dev server, then test the enrichment module directly:

```bash
# Start dev server
npm run dev
```

In another terminal, verify that `resolveWebsite` works for a real tool URL. This is done via the backfill API or by checking console output during a scrape. For direct testing, you can create a temporary test endpoint or use the `/api/enrich` route.

### Test 2: Run Enrichment Backfill

```bash
# Enrich all tools missing website_url (limit to 5 for testing)
curl -X POST http://localhost:3000/api/enrich \
  -H 'Content-Type: application/json' \
  -H 'x-devscout-admin-secret: YOUR_ADMIN_SECRET' \
  -d '{"limit": 5}'
```

**Expected response**: A summary with `enriched`, `failed`, `skipped` counts and per-tool details.

**Watch the dev server terminal** — you should see:
```
📦 [Enrichment] Enriching "ToolName" from https://example.com...
  ✅ [Enrichment] Content fetched for "ToolName" (source: direct-fetch)
  🖼️  [Enrichment] Logo resolved for "ToolName" (source: simpleicons)
  ✅ [Enrich] Updated "ToolName"
```

### Test 3: Verify Homepage Filter

Open `http://localhost:3000` in a browser. Verify that:
1. Only analyzed tools with `curation_status = 'curated'` or `'reviewed'` appear
2. The 12 seed tools are visible (they have `curation_status = 'curated'`)
3. Auto-suggested tools are NOT visible

### Test 4: Verify Schema

Check in Supabase Dashboard → Table Editor → `tools` table:
- `website_url` column exists on each tool
- `curation_status` column exists with values: `curated` (seed tools) or `auto-suggested` (scraped tools)

```sql
SELECT id, name, website_url, curation_status FROM public.tools ORDER BY name;
```

### Test 5: Run Full Scrape + Enrich

```bash
# Scrape a source with enrichment enabled
curl -X POST http://localhost:3000/api/scrape \
  -H 'Content-Type: application/json' \
  -H 'x-devscout-admin-secret: YOUR_ADMIN_SECRET' \
  -d '{"sourceIds": ["source-uuid"], "perSourceLimit": 3}'
```

**Watch the dev server terminal** — you should see enrichment logs interleaved with scraping logs:
```
📡 [Scrape] Starting scrape for Product Hunt...
📄 [Scrape] Homepage fetched...
🔗 [Scrape] Found 15 candidate links...
📄 [Scrape] Fetching detail pages...
    ✅ [Scrape] Inserted "ToolName" from Product Hunt
    📦 [Enrichment] Enriching "ToolName" from https://actual-tool-website.com...
    ✅ [Enrichment] Content fetched (source: direct-fetch)
    🖼️  [Enrichment] Logo resolved (source: simpleicons)
```

---

## Implementation Order

This implementation should be executed in this exact order:

1. **Database Engineer** — Run ALTER TABLE SQL in Supabase Dashboard. Update `supabase/schema.sql` and `lib/supabase/types.ts`.
2. **Backend Engineer** — Create `lib/enrichment/` module (5 files: `types.ts`, `resolve-website.ts`, `jina-fallback.ts`, `logo-resolver.ts`, `index.ts`).
3. **Backend Engineer** — Update parsers to pass `websiteUrl` through (Product Hunt, GitHub Trending, BetaList, SaaSHub, Dev.to, Reddit).
4. **Backend Engineer** — Update `lib/scrape/pipeline.ts` to integrate enrichment after detail page extraction.
5. **Database Engineer / Backend Engineer** — Update `supabase/seed-data.sql` with `website_url` and `curation_status`.
6. **Backend Engineer** — Create `app/api/enrich/route.ts` for post-enrichment backfill.
7. **Frontend Engineer** — Add `curationStatus` filter to `getTools()` query and update `app/page.tsx`.
8. **Code Reviewer** — Review all diffs.
9. **QA Engineer** — Run checks, verify homepage shows correct tools.
10. **Documentation Memory Agent** — Log outcome to `docs/agents/memory-log.md`.
11. **CEO Assistant** — Compile final report.

---

## Handoff Notes

- **Database Engineer** handles schema changes (Module 0 + seed data update)
- **Backend Engineer** handles enrichment module (Module 1), parser updates (Module 2), pipeline integration (Module 3), backfill API (Module 6)
- **Frontend Engineer** handles homepage filter (Module 5)
- **Security Engineer** reviews enrichment fetch logic — no new credentials, SSRF prevention, timeout handling
- **Code Reviewer** reviews all diffs — check for: server-only imports, no secret exposure, error handling completeness, enrichment non-blocking guarantee
- **QA Engineer** runs `typecheck`, `lint`, `build` and reports exact output; confirms the 5 test steps above
- **Documentation Memory Agent** logs outcome to `docs/agents/memory-log.md`
- **CEO Assistant** compiles final report

---

## Next Steps After This Prompt

1. Update ADR-003 (curation_status default from `pending` → `auto-suggested`)
2. Admin review UI for auto-suggested tools (future work — allow admins to mark tools as `curated` or `rejected`)
3. Cross-source deduplication via `website_url` (future work — use `website_url` as dedupe key in addition to `original_url`)
4. Enrichment-triggered re-analysis (automatically re-analyze tools when enrichment improves their raw_text)

---

*Prompt created by Prompt Engineer for Database Engineer, Backend Engineer, Frontend Engineer, Security Engineer, Code Reviewer, and QA Engineer implementation*
