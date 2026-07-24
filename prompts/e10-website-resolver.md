# Prompt: E10 — Website Resolver

## Goal

Create `lib/enrichment/website-resolver.ts` — a module that resolves a tool's canonical website URL from the scraped data during enrichment. It chains multiple discovery methods: parser-extracted URL, homepage link, GitHub homepage field, GitHub README homepage, and package metadata. Returns confidence-graded results.

## Assigned Specialist Agent(s)

- **Backend Engineer** (primary — create module, integrate into enrichment pipeline)

## Skills Read

- Existing `AGENTS.md` — Sections 7 (tool storage: website_url field), 11 (candidate link extraction), 13 (validation rules), 21 (code standards)

## Existing Code Inspected

- `lib/enrichment/types.ts` — `ResolvedWebsite`, `EnrichmentResult`, `EnrichmentSummary`
- `lib/enrichment/resolve-website.ts` — existing URL normalization (`normalizeWebsiteUrl`)
- `lib/scrape/types.ts` — `CandidateLink` (has `websiteUrl` field), `ScrapedTool` (has `websiteUrl` field)
- `lib/scrape/pipeline.ts` — website_url resolution logic in pipeline (lines 624-640), where websiteUrl is currently assigned from candidate data or URL heuristics
- `lib/scrape/parsers/producthunt.ts` — already passes `websiteUrl` through candidates
- `lib/supabase/types.ts` — `Tool.website_url` field, `ToolWithSource`
- `lib/enrichment/index.ts` — enrichment pipeline flow

## Decisions or Assumptions

1. **The module is additive** — it replaces the inline URL resolution in pipeline.ts lines 624-640 with a dedicated, chainable resolver that can be reused in enrichment and backfill.
2. **URL resolution priority chain** (tried in order, first valid wins):
   - **Parser-extracted URL** — the `websiteUrl` field from `CandidateLink` (extracted by source-specific parsers like Product Hunt)
   - **Homepage link** — look for a link in the scraped content that points to the tool's own domain (not the source domain)
   - **GitHub homepage field** — if the detected GitHub URL has a `homepage` link, use that
   - **GitHub README homepage** — parse the GitHub README for a homepage link
   - **Package metadata** — check npm/PyPI package.json for homepage field
3. **Reject certain domains as official websites** — github.com (unless OSS-only signal), npm, PyPI, Reddit, Product Hunt, Medium, YouTube, Twitter/X, LinkedIn.
4. **Returns `WebsiteResolution`** with `{ officialWebsite, githubUrl, confidence }` where confidence is 0-1 based on source reliability:
   - Parser-extracted URL: 1.0
   - Homepage link from content: 0.8
   - GitHub homepage field: 0.7
   - GitHub README: 0.5
   - Package metadata: 0.6
5. **Integration point**: The resolver is called during enrichment (in `enrichTool` or a new enrichment step), and the result populates `ScrapedTool.websiteUrl` when it's missing or replaces low-confidence URLs.
6. **No external API calls** — the resolver only inspects data already available. No fetching.
7. **The existing inline heuristic in pipeline.ts lines 624-640 is replaced** by calling `resolveWebsiteUrl()`.

## Files Likely to Change

| File | Change |
|------|--------|
| `lib/enrichment/website-resolver.ts` | **Create** — `resolveWebsiteUrl()`, helpers |
| `lib/enrichment/types.ts` | **Modify** — add `WebsiteResolution` type |
| `lib/enrichment/index.ts` | **Modify** — export new module, optionally integrate into enrichment |
| `lib/scrape/pipeline.ts` | **Modify** — replace inline URL resolution (lines 624-640) with call to `resolveWebsiteUrl()` |
| `lib/scrape/parsers/index.ts` | No change — parsers already return `websiteUrl` in CandidateLink |

## Implementation Requirements

### Step 1: Add `WebsiteResolution` type to `lib/enrichment/types.ts`

```typescript
/**
 * Result of resolving a tool's canonical website URL.
 */
export interface WebsiteResolution {
  /** The resolved official website URL, or null if not found. */
  officialWebsite: string | null;
  /** The detected GitHub repository URL, or null. */
  githubUrl: string | null;
  /** Confidence score 0-1. Higher means more reliable source. */
  confidence: number;
  /** Which method produced the result. */
  method: 'parser-extracted' | 'homepage-link' | 'github-homepage' | 'github-readme' | 'package-metadata' | 'none';
}
```

### Step 2: Create `lib/enrichment/website-resolver.ts`

```typescript
import 'server-only';

// lib/enrichment/website-resolver.ts
// Resolves a tool's canonical website URL from scraped data.
// Chains multiple discovery methods to find the best URL.

import type { WebsiteResolution } from './types';

// ---------------------------------------------------------------------------
// Reject list — domains that are NOT official tool websites
// ---------------------------------------------------------------------------

const REJECTED_DOMAINS = [
  /^https?:\/\/(?:www\.)?github\.com\//i,
  /^https?:\/\/(?:www\.)?npmjs\.com\//i,
  /^https?:\/\/(?:www\.)?pypi\.org\//i,
  /^https?:\/\/(?:www\.)?rubygems\.org\//i,
  /^https?:\/\/(?:www\.)?crates\.io\//i,
  /^https?:\/\/(?:www\.)?producthunt\.com\//i,
  /^https?:\/\/(?:www\.)?reddit\.com\//i,
  /^https?:\/\/(?:www\.)?medium\.com\//i,
  /^https?:\/\/(?:www\.)?youtube\.com\//i,
  /^https?:\/\/(?:www\.)?youtu\.be\//i,
  /^https?:\/\/(?:www\.)?twitter\.com\//i,
  /^https?:\/\/(?:www\.)?x\.com\//i,
  /^https?:\/\/(?:www\.)?linkedin\.com\//i,
  /^https?:\/\/(?:www\.)?dev\.to\//i,
  /^https?:\/\/(?:www\.)?betalist\.com\//i,
  /^https?:\/\/(?:www\.)?saashub\.com\//i,
  /^https?:\/\/(?:www\.)?news\.ycombinator\.com\//i,
];

/**
 * Check if a URL is a rejected domain (not a valid official website).
 */
function isRejectedDomain(url: string): boolean {
  return REJECTED_DOMAINS.some(pattern => pattern.test(url));
}

/**
 * Normalize a website URL.
 */
function normalizeUrl(raw: string): string {
  let url = raw.trim();

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    parsed.protocol = 'https:';
    parsed.hash = '';
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Extract the hostname from a URL (for cross-domain comparison).
 */
function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// URL resolution methods
// ---------------------------------------------------------------------------

/**
 * Tier 1: Parser-extracted URL.
 * The source-specific parser already extracted a websiteUrl from the listing.
 * This is the most reliable source.
 */
function resolveFromParserUrl(parserUrl: string): WebsiteResolution | null {
  const normalized = normalizeUrl(parserUrl);

  if (isRejectedDomain(normalized)) {
    return null;
  }

  return {
    officialWebsite: normalized,
    githubUrl: normalized.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+\/[^/]+)/i)
      ? normalized.replace(/\/$/, '')
      : null,
    confidence: 1.0,
    method: 'parser-extracted',
  };
}

/**
 * Tier 2: Homepage link from scraped content.
 * Look for links in the raw text or candidates that point to a different domain
 * than the source listing URL. Prefer links that contain tool name keywords.
 */
function resolveFromHomepageLink(
  rawText: string,
  sourceListingUrl: string
): WebsiteResolution | null {
  const sourceHostname = extractHostname(sourceListingUrl);
  if (!sourceHostname) return null;

  // Extract all URLs from raw text
  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
  const matches = rawText.match(urlRegex);
  if (!matches || matches.length === 0) return null;

  const sourceDomain = sourceHostname;

  // Find the first URL that's NOT on the same domain as the source
  // and is not on the rejected domains list
  for (const match of matches) {
    const targetHostname = extractHostname(match);
    if (!targetHostname) continue;
    if (targetHostname === sourceDomain) continue;
    if (isRejectedDomain(match)) continue;

    const normalized = normalizeUrl(match);

    return {
      officialWebsite: normalized,
      githubUrl: normalized.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+\/[^/]+)/i)
        ? normalized.replace(/\/$/, '')
        : null,
      confidence: 0.8,
      method: 'homepage-link',
    };
  }

  return null;
}

/**
 * Tier 3: GitHub homepage field.
 * If we have a GitHub URL, fetch the repo metadata or parse its README
 * to find the homepage link. This is called after GitHub detection.
 */

/**
 * Parse a GitHub URL to extract owner/repo.
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

/**
 * Check if a URL is a GitHub repository URL.
 */
function isGitHubUrl(url: string): boolean {
  return /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)/i.test(url);
}

// ---------------------------------------------------------------------------
// Main resolver function
// ---------------------------------------------------------------------------

/**
 * Resolve a tool's official website URL from scraped data.
 *
 * Priority chain:
 *   1. Parser-extracted URL from candidate
 *   2. Homepage link from scraped content (different domain than source)
 *   3. N/A — external API methods (GitHub, package) are out of scope here
 *
 * @param params.parserUrl - URL extracted by the source parser (CandidateLink.websiteUrl)
 * @param params.rawText - Raw scraped text to search for homepage links
 * @param params.sourceListingUrl - The source's own listing URL (for cross-domain detection)
 * @returns WebsiteResolution with resolved URL and confidence
 */
export async function resolveWebsiteUrl(params: {
  parserUrl?: string | null;
  rawText?: string | null;
  sourceListingUrl?: string | null;
}): Promise<WebsiteResolution> {
  const { parserUrl, rawText, sourceListingUrl } = params;

  // Tier 1: Parser-extracted URL — most reliable
  if (parserUrl) {
    const result = resolveFromParserUrl(parserUrl);
    if (result) return result;
  }

  // Tier 2: Homepage link from scraped content
  if (rawText && sourceListingUrl) {
    const result = resolveFromHomepageLink(rawText, sourceListingUrl);
    if (result) return result;
  }

  return {
    officialWebsite: null,
    githubUrl: null,
    confidence: 0,
    method: 'none',
  };
}
```

### Step 3: Export the new module from `lib/enrichment/index.ts`

Add to the export block:

```typescript
export { resolveWebsiteUrl } from './website-resolver';
export type { WebsiteResolution } from './types';
```

### Step 4: Replace inline URL resolution in `lib/scrape/pipeline.ts`

Replace the block at lines 624-640:

```typescript
// ===================================================================
// PHASE: RESOLVE_URL — Resolve tool's canonical website URL
// ===================================================================
if (!scrapedTool.websiteUrl) {
  // Use the candidate's websiteUrl (parser-extracted) if available
  if (candidate.websiteUrl) {
    scrapedTool.websiteUrl = candidate.websiteUrl;
  } else {
    // Fall back to the resolver for homepage link discovery
    const { resolveWebsiteUrl } = await import('@/lib/enrichment/website-resolver');
    const resolution = await resolveWebsiteUrl({
      parserUrl: candidate.websiteUrl,
      rawText: detailResult.content,
      sourceListingUrl: source.listing_url,
    });

    if (resolution.officialWebsite) {
      scrapedTool.websiteUrl = resolution.officialWebsite;
      console.log(`    🌐 [Pipeline] Resolved website URL: ${resolution.officialWebsite} (${resolution.method})`);
    }
  }
}
```

This replaces the existing heuristic logic while preserving the candidate.websiteUrl path.

### Step 5: Export `website-resolver` related types

Update `lib/enrichment/types.ts` to include the new `WebsiteResolution` type in the barrel export pattern (line 16 area).

## Security Requirements

- `import 'server-only';` at top of `website-resolver.ts`
- No client-side exposure of resolved URLs beyond normal data display

## Acceptance Criteria

1. `lib/enrichment/website-resolver.ts` exists with `resolveWebsiteUrl()`
2. `WebsiteResolution` type added to `lib/enrichment/types.ts`
3. 5-tier priority chain: parser-extracted → homepage-link → github-homepage → github-readme → package-metadata
4. Rejected domains: github.com (unless OSS-only), npm, PyPI, Reddit, Product Hunt, Medium, YouTube, Twitter/X, LinkedIn
5. Confidence scoring: parser-extracted 1.0, homepage-link 0.8, github-homepage 0.7, github-readme 0.5, package-metadata 0.6
6. Inline URL resolution in pipeline.ts (lines 624-640) replaced with `resolveWebsiteUrl()` call
7. Module exported from `lib/enrichment/index.ts`
8. `npm run typecheck` passes with zero errors
9. `npm run lint` passes with zero new errors

## Checks to Run

- `npm run typecheck` — TypeScript, no emit
- `npm run lint` — ESLint
- `npm run build` — Next.js production build

## Exact Manual Test Steps

1. Run `npm run dev` and watch the terminal.
2. Trigger a scrape:
   ```bash
   curl -X POST http://localhost:3000/api/scrape \
     -H "Content-Type: application/json" \
     -H "x-devscout-admin-secret: YOUR_ADMIN_SECRET" \
     -d '{"sourceNames": ["producthunt"], "perSourceLimit": 2}'
   ```
3. Observe console logs — should see `🌐 [Pipeline] Resolved website URL: ...` with the resolution method.
4. Verify tools are inserted with correct `website_url` in the database.
5. Run `npm run typecheck && npm run lint && npm run build` — all must pass.
