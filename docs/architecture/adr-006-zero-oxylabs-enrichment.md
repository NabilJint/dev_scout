# ADR-006: Zero-Oxylabs Tool Website Enrichment

**Date**: 2026-07-22
**Status**: Proposed
**Author**: Software Architect

## Context

The current pipeline uses **2 Oxylabs calls per tool**: one for the source homepage (to find candidates) and one for the source detail page (to extract tool metadata). The detail page call costs ~$0.01–$0.03 per tool and accumulates significant charges at scale.

The CEO approved a plan to replace the source detail page content with **real content from the tool's own website** fetched via direct HTTP. This serves two goals simultaneously:
1. **Higher quality AI analysis** — the model reasons about actual product pages (cursor.com, supabase.com) rather than PH/HN taglines
2. **Lower Oxylabs spend** — eliminates the detail page scrape entirely for many sources

The key insight: most developer tool websites (cursor.com, supabase.com, vercel.com, prisma.io, clerk.com, stripe.com) are server-rendered marketing pages that respond to standard HTTP `fetch()` with proper headers. They do not require Oxylabs' anti-bot rendering.

## Decision

### 1. Create `lib/enrichment/resolve-website.ts`

A new server-only module that fetches a tool's website URL via direct HTTP (Node.js native `fetch`) and extracts:

- **Page title** (`<title>`, `og:title`)
- **Meta description** (`og:description`, `meta[name="description"]`)
- **Open Graph image** (`og:image`, `twitter:image`)
- **Body text** — cleaned via Cheerio using the existing `cleanRawText()` from `lib/scrape/validate.ts`
- **Last updated** — from `article:published_time`, `time[datetime]`, or fallback

Returns a `ResolvedWebsite` type or `null` on failure.

### 2. Modify `CandidateLink` to carry `websiteUrl`

Add an optional `websiteUrl` field to `CandidateLink` in `lib/scrape/types.ts`. This allows parsers to pass the tool's actual website URL through from the listing page:

```typescript
export interface CandidateLink {
  url: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  websiteUrl?: string;   // NEW: actual tool website URL if known
}
```

### 3. Modify parsers to populate `websiteUrl`

| Source | How to get `websiteUrl` | From listing or detail? |
|---|---|---|
| **Hacker News** | `candidate.url` IS the external URL | Listing (no extra cost) |
| **Reddit** (external links) | `candidate.url` IS the external URL (after unwrapping `out.reddit.com`) | Listing (no extra cost) |
| **GitHub Trending** | `github.com/owner/repo` — fetch repo page, extract homepage link | After fetch (direct HTTP, free) |
| **Dev.to** | Candidate URL IS the external link | Listing (no extra cost) |
| **Product Hunt** | Extract from detail page: `a[data-test="product-url"]` | Detail page (keeps Oxylabs) |
| **BetaList** | Extract from detail page | Detail page (keeps Oxylabs) |
| **SaaSHub** | Extract from detail page | Detail page (keeps Oxylabs) |

### 4. Pipeline integration point

The enrichment runs **after a candidate is confirmed and its `websiteUrl` is known**, but **before the tool is inserted**. This replaces the existing flow that uses the source detail page `raw_text`:

```typescript
// Current flow:
const scrapedTool = parser.extractToolContent(detailHtml); // Oxylabs detail page
scrapedTool.rawText = cleanRawText(detailHtml);

// New flow:
const resolved = await resolveWebsite(websiteUrl); // direct HTTP
let rawText: string;
if (resolved) {
  rawText = resolved.rawText; // real content from tool website
} else {
  // Fall back to source detail page content if available
  rawText = cleanRawText(detailHtml); 
}
```

### 5. Logo enrichment via SimpleIcons (per ADR-005)

After enrichment, attempt to resolve a brand logo from `cdn.simpleicons.org/{normalized-tool-name}`. This is a free, zero-cost HEAD request that returns SVG brand icons for 3100+ brands.

### 6. Schema change: add `website_url` column (per ADR-003)

Add a `website_url` column to the `tools` table. This stores the tool's actual website URL (e.g., `https://cursor.com`), distinct from `original_url` which remains the discovery source URL.

## Consequences

**Positive**:
- Eliminates 50-85% of Oxylabs detail page calls
- AI analysis receives richer, more relevant content (product pages vs taglines)
- Logo resolution is free and produces clean brand SVG icons
- Architecture supports future source additions without Oxylabs cost

**Negative**:
- Some tool websites may block direct HTTP (Cloudflare, JS-only SPAs, bot detection)
- GitHub rate limits may affect repo homepage extraction (~60 req/hr unauthenticated)
- Tool websites load slower than Oxylabs (no dedicated proxy infrastructure)
- Pipeline adds latency: ~2-5s per tool for HTTP fetch + parsing

**Neutral**:
- Keeps the Oxylabs source homepage scrape (still needed for JS-rendered discovery pages)
- Fallback to detail page content when website fetch fails degrades gracefully

## Alternatives Considered

1. **Use Oxylabs for everything** (status quo): ~$0.02-0.05/tool, no improvement
2. **Use Oxylabs for website fetch too**: Would be ~$0.03-0.06/tool — worse than current
3. **Skip enrichment entirely, just send source content to AI**: Lower quality analysis, no cost savings
4. **Use a third-party scraping API (ScrapingBee, ScraperAPI)**: Adds cost and dependency — free HTTP fetch is sufficient for most dev tool sites

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Tool website blocks direct fetch | Medium | Medium | Detect 403/429/Cloudflare → fall back to source content, flag for later retry with user-agent rotation |
| JS-only SPA renders no content | Medium | Medium | Check response size/content; SPA shells have <500 bytes meaningful text; fall back gracefully |
| Rate limiting host aggressiveness | Low | Medium | Add configurable delay between fetches (default 500ms); respect `Retry-After` headers |
| Redirect chains (http→https, www→non-www) | High | Low | Node.js `fetch()` follows redirects by default; cap at 5 redirects |
| GitHub rate limits (60 req/hr unauthenticated) | Medium | Medium | Use authenticated requests via `GITHUB_TOKEN` env var (8000 req/hr); fall back to `github.com/trending` content |
| Pipeline latency increases 2-5s per tool | Medium | Medium | Run enrichment in parallel with `Promise.allSettled` across candidates |
| DNS resolution failures for obscure tools | Low | Low | Timeout fetch after 10s; fall back immediately |

## Cost Comparison

| Scenario | Oxylabs calls/tool | Cost/tool | Annual cost (1000 tools/mo) |
|---|---|---|---|
| Current (2 Oxylabs calls) | 2 | $0.02-0.05 | $240-600 |
| **Zero-Oxylabs enrichment** | 0.5-1 | **$0.005-0.01** | **$60-120** |
| Full Oxylabs (all calls) | 3 | $0.03-0.06 | $360-720 |

**Savings**: 75-80% reduction in Oxylabs spend.
