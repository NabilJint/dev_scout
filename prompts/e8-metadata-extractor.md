# Prompt: E8 — Metadata Extractor

## Goal

Create a `lib/enrichment/metadata-extractor.ts` module that extracts structured metadata from HTML pages. Extract OpenGraph tags, JSON-LD (especially `@type: SoftwareApplication`), and standard meta tags. Integrate into the enrichment pipeline as an additive step — existing enrichment logic must not break.

## Assigned Specialist Agent(s)

- **Backend Engineer** (primary — create module, integrate into enrichment)

## Skills Read

- Existing `AGENTS.md` — Sections 7 (tool storage fields), 13 (tool validation), 21 (code standards)

## Existing Code Inspected

- `lib/enrichment/types.ts` — `ResolvedWebsite`, `EnrichedContent`, `LogoResult`
- `lib/enrichment/resolve-website.ts` — existing `extractOpenGraph()` function (lines 266-286), `extractLastUpdated()`, `extractTitle()`
- `lib/enrichment/index.ts` — `enrichTool()` orchestrator, `fetchWebsiteContent()`
- `lib/enrichment/jina-fallback.ts` — Jina response parsing
- `lib/enrichment/logo-resolver.ts` — logo resolution patterns
- `lib/scrape/validate.ts` — Cheerio usage patterns

## Decisions or Assumptions

1. **This is additive only** — the existing `extractOpenGraph()` function in `resolve-website.ts` remains untouched. The new module provides a more comprehensive extraction, and is called separately during enrichment.
2. **JSON-LD is parsed with `JSON.parse`** (not a full JSON-LD processor) — we extract raw `@type`, `name`, `description`, `logo`, `url`, `applicationCategory` fields from `application/ld+json` script tags.
3. **The module returns a `PageMetadata` type** that includes all extracted metadata, with optional fields. The enrichment pipeline stores this in the `metadata` field during processing.
4. **Extraction is best-effort** — if no metadata is found, all fields are null. Never throw.
5. **Output is integrated into enrichment** — the `enrichTool()` function in `lib/enrichment/index.ts` calls `extractMetadata()` after fetching website content, and the metadata is returned alongside the existing `content` and `logo` results.
6. **The `EnrichedContent` type is extended** with an optional `metadata: PageMetadata | null` field, NOT a breaking change.

## Files Likely to Change

| File | Change |
|------|--------|
| `lib/enrichment/metadata-extractor.ts` | **Create** — `extractMetadata(html: string): PageMetadata` |
| `lib/enrichment/types.ts` | **Modify** — add `PageMetadata` interface, update `EnrichedContent` with optional `metadata` |
| `lib/enrichment/index.ts` | **Modify** — call `extractMetadata()` after fetching website content, include in return |
| `lib/enrichment/resolve-website.ts` | No change — existing `extractOpenGraph` stays |

## Implementation Requirements

### Step 1: Add `PageMetadata` type to `lib/enrichment/types.ts`

Add this interface to the existing file:

```typescript
/**
 * Structured metadata extracted from a tool's HTML page.
 * All fields are best-effort — null if not found.
 */
export interface PageMetadata {
  /** OpenGraph tags */
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogUrl: string | null;
  ogType: string | null;
  ogSiteName: string | null;

  /** Twitter Card tags */
  twitterCard: string | null;
  twitterSite: string | null;
  twitterCreator: string | null;

  /** Standard meta tags */
  metaDescription: string | null;
  metaKeywords: string | null;
  canonicalUrl: string | null;

  /** JSON-LD fields */
  jsonLdType: string | null;
  jsonLdName: string | null;
  jsonLdDescription: string | null;
  jsonLdLogo: string | null;
  jsonLdUrl: string | null;
  jsonLdApplicationCategory: string | null;
  jsonLdOperatingSystem: string | null;

  /** Raw JSON-LD blocks (unparsed, for debugging) */
  rawJsonLd: string[] | null;
}
```

### Step 2: Update `EnrichedContent` in `lib/enrichment/types.ts`

Add an optional `metadata` field:

```typescript
export interface EnrichedContent {
  websiteUrl: string;
  title: string;
  description: string;
  ogImage: string | null;
  rawText: string;
  source: 'direct-fetch' | 'jina-reader' | 'failed';

  /** NEW: Structured metadata extracted from the page. */
  metadata: PageMetadata | null;
}
```

### Step 3: Create `lib/enrichment/metadata-extractor.ts`

```typescript
import 'server-only';
import * as cheerio from 'cheerio';
import type { PageMetadata } from './types';

/**
 * Extract structured metadata from HTML.
 *
 * Returns a PageMetadata object with all known fields populated
 * (or null if not found). Never throws — always returns a valid object.
 *
 * @param html - Raw HTML string to extract metadata from.
 * @returns PageMetadata with extracted fields.
 */
export function extractMetadata(html: string): PageMetadata {
  const $ = cheerio.load(html);

  // ---- OpenGraph tags ----
  const ogTitle = $('meta[property="og:title"]').attr('content') || null;
  const ogDescription = $('meta[property="og:description"]').attr('content') || null;
  const ogImage = $('meta[property="og:image"]').attr('content') || null;
  const ogUrl = $('meta[property="og:url"]').attr('content') || null;
  const ogType = $('meta[property="og:type"]').attr('content') || null;
  const ogSiteName = $('meta[property="og:site_name"]').attr('content') || null;

  // ---- Twitter Card tags ----
  const twitterCard = $('meta[name="twitter:card"]').attr('content') || null;
  const twitterSite = $('meta[name="twitter:site"]').attr('content') || null;
  const twitterCreator = $('meta[name="twitter:creator"]').attr('content') || null;

  // ---- Standard meta tags ----
  const metaDescription = $('meta[name="description"]').attr('content') || null;
  const metaKeywords = $('meta[name="keywords"]').attr('content') || null;
  const canonicalUrl = $('link[rel="canonical"]').attr('href') || null;

  // ---- JSON-LD extraction ----
  let jsonLdType: string | null = null;
  let jsonLdName: string | null = null;
  let jsonLdDescription: string | null = null;
  let jsonLdLogo: string | null = null;
  let jsonLdUrl: string | null = null;
  let jsonLdApplicationCategory: string | null = null;
  let jsonLdOperatingSystem: string | null = null;
  const rawJsonLd: string[] = [];

  $('script[type="application/ld+json"]').each((_i, el) => {
    const raw = $(el).html() || '';
    if (!raw.trim()) return;

    rawJsonLd.push(raw);

    try {
      const parsed = JSON.parse(raw);

      // Handle @graph arrays — find the SoftwareApplication node
      const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
      const itemsArr = Array.isArray(items) ? items : [items];

      for (const item of itemsArr) {
        if (!item || typeof item !== 'object') continue;

        const type = item['@type'] || '';
        // Prefer SoftwareApplication, but accept any typed item as fallback
        if (!jsonLdType || type === 'SoftwareApplication' || type === 'WebApplication' || type === 'MobileApplication') {
          jsonLdType = type || null;
          if (item.name) jsonLdName = item.name;
          if (item.description) jsonLdDescription = item.description;
          if (item.url) jsonLdUrl = item.url;
          if (item.applicationCategory) jsonLdApplicationCategory = item.applicationCategory;
          if (item.operatingSystem) jsonLdOperatingSystem = item.operatingSystem;

          // Logo can be string URL or an ImageObject with a 'url' or 'contentUrl' field
          if (item.logo) {
            if (typeof item.logo === 'string') {
              jsonLdLogo = item.logo;
            } else if (item.logo.url) {
              jsonLdLogo = item.logo.url;
            } else if (item.logo.contentUrl) {
              jsonLdLogo = item.logo.contentUrl;
            }
          }
        }
      }
    } catch {
      // Non-critical — skip malformed JSON-LD
    }
  });

  return {
    ogTitle,
    ogDescription,
    ogImage,
    ogUrl,
    ogType,
    ogSiteName,
    twitterCard,
    twitterSite,
    twitterCreator,
    metaDescription,
    metaKeywords,
    canonicalUrl,
    jsonLdType,
    jsonLdName,
    jsonLdDescription,
    jsonLdLogo,
    jsonLdUrl,
    jsonLdApplicationCategory,
    jsonLdOperatingSystem,
    rawJsonLd: rawJsonLd.length > 0 ? rawJsonLd : null,
  };
}
```

Implementation details:
- Import `cheerio` for HTML parsing
- Accept `html: string` parameter
- Extract all OpenGraph meta tags via `meta[property="og:*"]`
- Extract Twitter Card meta tags via `meta[name="twitter:*"]`
- Extract standard meta tags (`description`, `keywords`)
- Extract canonical URL from `link[rel="canonical"]`
- Parse all `script[type="application/ld+json"]` blocks
  - Handle `@graph` arrays (multiple items in one script tag)
  - Prefer `SoftwareApplication`, `WebApplication`, `MobileApplication` types
  - Extract `logo` as string URL or from `ImageObject` sub-object
- Never throw — wrap JSON-LD parsing in try/catch
- Return completed `PageMetadata` object

### Step 4: Update `lib/enrichment/index.ts`

Call `extractMetadata()` after fetching website content and include in the return:

1. **Add import** at top:
   ```typescript
   import { extractMetadata } from './metadata-extractor';
   ```

2. **Update `fetchWebsiteContent()`** to call `extractMetadata()` after acquiring HTML:
   - In the direct-fetch path (after `resolveWebsite` succeeds), we don't have the raw HTML (we only have `rawText`). The metadata extraction happens on the raw HTML. Since `resolveWebsite` discards the HTML after cleaning, we have two approaches:
     - **Option A (recommended):** Accept `metadata: null` for the direct-fetch path initially, since the Cheerio parsing is done inside `resolveWebsite`. The metadata can be extracted by a separate call if needed.
     - **Option B:** Pass the raw HTML alongside the resolved content. This requires modifying `ResolvedWebsite` or the internal flow.
   
   **Decision: Use Option A for now.** The metadata extractor is most useful when the full HTML is available, which happens in the Jina path (Jina returns markdown, not HTML) and in the pipeline's detail page fetch. The direct-fetch path via `resolveWebsite` already extracts OG tags internally. We add metadata extraction to the `enrichTool` function, extracting from the website URL's HTML if available.

   Since `fetchWebsiteContent` doesn't retain the raw HTML, the pragmatic approach is to:
   - Return `metadata: null` in the `EnrichedContent` from `fetchWebsiteContent`
   - Add a separate `extractMetadata()` call in the **pipeline** or in `enrichTool` when the raw HTML is available (i.e., from the detail page scrape)

   **Simpler approach:** Since `resolveWebsite` already has the Cheerio-loaded HTML, the cleanest integration is to call `extractMetadata` on the raw HTML inside `resolveWebsite` and attach metadata to `ResolvedWebsite`. But that breaks the "additive only" rule.

   **Final decision:** Export `extractMetadata` from `lib/enrichment/index.ts` so pipeline.ts and other consumers can call it directly against raw HTML. Do NOT modify the existing enrichment plumbing. Add the re-export:
   ```typescript
   export { extractMetadata } from './metadata-extractor';
   export type { PageMetadata } from './types';
   ```

3. **Update `EnrichedContent` return** in `fetchWebsiteContent()` — set `metadata: null` for now:
   - In the direct-fetch success branch:
     ```typescript
     metadata: null,
     ```
   - In the Jina success branch:
     ```typescript
     metadata: null,
     ```

## Security Requirements

- `import 'server-only';` at top of `metadata-extractor.ts`
- No client-side exposure of HTML or metadata

## Acceptance Criteria

1. `lib/enrichment/metadata-extractor.ts` exists with `extractMetadata(html: string): PageMetadata`
2. `PageMetadata` interface defined in `lib/enrichment/types.ts` with all specified fields
3. `EnrichedContent` in `lib/enrichment/types.ts` has optional `metadata: PageMetadata | null`
4. `extractMetadata` is exported from `lib/enrichment/index.ts`
5. Existing enrichment functions unchanged — additive only
6. JSON-LD parsing handles `@graph` arrays, `SoftwareApplication` type preference, nested `logo` objects
7. `npm run typecheck` passes with zero errors
8. `npm run lint` passes with zero new errors
9. `npm run build` passes

## Checks to Run

- `npm run typecheck` — TypeScript, no emit
- `npm run lint` — ESLint
- `npm run build` — Next.js production build

## Exact Manual Test Steps

1. Create a simple test script or use `node` to verify:
   ```typescript
   import { extractMetadata } from '@/lib/enrichment/metadata-extractor';
   const html = `
   <!DOCTYPE html>
   <html>
   <head>
     <meta property="og:title" content="Test Tool" />
     <meta property="og:description" content="A test tool description" />
     <meta property="og:image" content="https://example.com/og.png" />
     <script type="application/ld+json">
       {"@type":"SoftwareApplication","name":"Test Tool","description":"A JSON-LD description","applicationCategory":"DeveloperApplication"}
     </script>
   </head>
   <body></body>
   </html>`;
   const meta = extractMetadata(html);
   console.log(JSON.stringify(meta, null, 2));
   ```
2. Run `npm run typecheck && npm run lint && npm run build` — all must pass.
3. Verify `extractMetadata` is importable from `@/lib/enrichment`:
   ```typescript
   import { extractMetadata } from '@/lib/enrichment'; // should resolve
   ```
