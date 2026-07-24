# Prompt: Content Scoring Function

## Goal

Replace the current binary content quality check (`content.length > 200`) in the enrichment pipeline with a weighted scoring function that evaluates multiple signals. The new `scoreContentQuality()` function returns a numeric score using the formula:

```
score = contentLength + titlePresent + mainElement + markdownDensity - spaShellPenalty - captchaPenalty
```

This richer scoring enables the pipeline to accept high-quality content that is short (e.g., a concise product landing page) while rejecting low-quality content that is long (e.g., a page full of boilerplate, scripts, or marketing fluff).

## Assigned Specialist Agent(s)

- **Backend Engineer** (primary — implement scoring function, integrate into enrichment)
- **Code Reviewer** (review diff)
- **QA Engineer** (run checks)

## Skills Read

- Existing `AGENTS.md` — Section 13 (tool validation rules)
- Existing code at `lib/scrape/validate.ts`, `lib/enrichment/resolve-website.ts`

## Existing Code Inspected

- `lib/scrape/validate.ts` — `cleanRawText`, `validateToolContent` (all 241 lines)
- `lib/scrape/types.ts` — `ScrapedTool`
- `lib/enrichment/resolve-website.ts` — where `rawText.length > 200` binary check currently lives
- `lib/enrichment/index.ts` — `enrichTool` where enrichment content quality is checked (line 459: `if (enrichment.content.rawText.length > 200)`)
- `lib/enrichment/types.ts` — `EnrichedContent`, `ResolvedWebsite` quality field
- `lib/supabase/types.ts` — `Tool`, `InsertToolParams`

## Decisions or Assumptions

1. **The scoring function is standalone and pure** — it takes a string of raw text and optional metadata, returns a numeric score. No side effects, no DB calls.
2. **The scoring replaces `content.length > 200`** in `lib/enrichment/index.ts` (line 459). The existing `validateToolContent` in `lib/scrape/validate.ts` uses different logic (paragraphs, character checks, non-product indicators) — that remains unchanged.
3. **Default threshold is 150** for accepting content. This means `scoreContentQuality(text) >= 150` passes. The threshold value should be exported as a configurable constant.
4. **The function signature is:** `scoreContentQuality(text: string, options?: ScoreOptions): ContentScore`
5. **The score is returned as an object** with the total score and each component sub-score for debugging.
6. **Scoring components:**
   - `contentLength`: `Math.min(rawText.length / 10, 100)` — length contributes up to 100 points, decaying at 1000+ chars
   - `titlePresent`: `20` if a `<title>` tag or `# ` markdown title is detected in the text, else `0`
   - `mainElement`: `30` if the text contains signals of being from `<main>`, `<article>`, `role="main"` (detect via markers like "main" in the extraction source), else `0`
   - `markdownDensity`: `(codeBlocks + headers + listItems) * 5` up to `50` — technical content tends to have markdown structure
   - `spaShellPenalty`: `-200` if text matches patterns of an SPA shell (empty divs, "Loading...", "Powered by", JavaScript error messages, CSS class dumps)
   - `captchaPenalty`: `-300` if text matches patterns of a captcha/blocked page (Cloudflare challenge, "Checking your browser", captcha, 403, DDoS protection)
7. **Edge case:** If the input is null, empty, or whitespace-only, return a score of 0 with all sub-scores at 0.
8. **Configurable threshold** via a `CONTENT_SCORE_THRESHOLD` environment variable (default 150).

## Files Likely to Change

| File | Change |
|------|--------|
| `lib/scrape/types.ts` | Add `ContentScore` interface, `ScoreOptions` interface |
| `lib/scrape/validate.ts` | Add `scoreContentQuality()` function, `DEFAULT_SCORE_THRESHOLD` constant |
| `lib/enrichment/index.ts` | Replace `content.length > 200` check with `scoreContentQuality()` call |
| `lib/enrichment/types.ts` | No changes needed (score is consumed internally) |

## Implementation Requirements

### Step 1: Define ContentScore and ScoreOptions types in `lib/scrape/types.ts`

```typescript
/**
 * Detailed breakdown of a content quality score.
 */
export interface ContentScore {
  /** Total weighted score. >= threshold means content is acceptable. */
  total: number;
  /** Contribution from content length (chars / 10, capped at 100). */
  contentLength: number;
  /** 20 points if a title element is detected. */
  titlePresent: number;
  /** 30 points if extracted from <main> or <article> element. */
  mainElement: number;
  /** Points from markdown structure density (code, headers, lists), up to 50. */
  markdownDensity: number;
  /** Penalty for SPA shell / boilerplate content (-200 max). */
  spaShellPenalty: number;
  /** Penalty for captcha / blocked page content (-300 max). */
  captchaPenalty: number;
  /** Whether the score passes the threshold. */
  acceptable: boolean;
}

/**
 * Options for scoring.
 */
export interface ScoreOptions {
  /** Whether the content was extracted from a <main> or <article> element. */
  fromMainElement?: boolean;
  /** Custom threshold override. Defaults to 150. */
  threshold?: number;
}
```

### Step 2: Implement `scoreContentQuality()` in `lib/scrape/validate.ts`

```typescript
import type { ContentScore, ScoreOptions } from './types';

// ... existing code ...

/**
 * Default threshold for content quality score.
 * Can be overridden via the CONTENT_SCORE_THRESHOLD env variable.
 */
export const DEFAULT_SCORE_THRESHOLD = parseInt(
  process.env.CONTENT_SCORE_THRESHOLD || '150',
  10
);

/**
 * Patterns that indicate an SPA shell (empty/dynamic content placeholder).
 */
const SPA_SHELL_PATTERNS = [
  /Loading\.\.\./i,
  /Please wait/i,
  /Powered by /i,
  /JavaScript required/i,
  /Enable JavaScript/i,
  /\[object Object\]/i,
  /undefined/i,
  /React\.createElement/i,
  /class=["'][a-zA-Z]/i,  // CSS class name dumps (not normal text)
  /<div><\/div>/i,
  /Cannot GET \//i,
  /404 Not Found/i,
];

/**
 * Patterns that indicate a captcha / blocked / security-challenge page.
 */
const CAPTCHA_PATTERNS = [
  /captcha/i,
  /cloudflare/i,
  /check(ing)? (your )?browser/i,
  /DDOS protection/i,
  /security check/i,
  /challenge-platform/i,
  /cf-turnstile/i,
  /cf-browser-verification/i,
  /Access denied/i,
  /403 Forbidden/i,
  /Just a moment/i,
];

/**
 * Score the quality of extracted raw text content.
 *
 * Returns a detailed ContentScore object with component breakdown.
 * Use `score.acceptable` to check if content passes the threshold.
 *
 * @param text - The raw text content to score (cleaned or uncleaned).
 * @param options - Optional scoring options (fromMainElement, threshold).
 * @returns ContentScore with total and component scores.
 */
export function scoreContentQuality(
  text: string | null | undefined,
  options: ScoreOptions = {}
): ContentScore {
  const threshold = options.threshold ?? DEFAULT_SCORE_THRESHOLD;
  const zeroScore: ContentScore = {
    total: 0,
    contentLength: 0,
    titlePresent: 0,
    mainElement: 0,
    markdownDensity: 0,
    spaShellPenalty: 0,
    captchaPenalty: 0,
    acceptable: false,
  };

  if (!text || text.trim().length === 0) {
    return zeroScore;
  }

  const trimmed = text.trim();

  // ---- Content Length ----
  // Up to 100 points, with diminishing returns after 1000 chars
  const contentLength = Math.min(Math.floor(trimmed.length / 10), 100);

  // ---- Title Present ----
  // Detect if the text includes what looks like a page title
  // (typically the first line looks like a title, or contains <title> remnants)
  const firstLine = trimmed.split('\n')[0]?.trim() || '';
  const hasTitleSignal =
    firstLine.length > 3 && firstLine.length < 200 && !firstLine.startsWith('//');
  const titlePresent = hasTitleSignal ? 20 : 0;

  // ---- Main Element ----
  // If the extraction source indicates this came from <main> or <article>
  const mainElement = options.fromMainElement ? 30 : 0;

  // ---- Markdown Density ----
  // Count structural elements typical of technical documentation
  const lines = trimmed.split('\n');
  let codeBlocks = 0;
  let headers = 0;
  let listItems = 0;

  for (const line of lines) {
    const l = line.trim();
    if (l.startsWith('```')) codeBlocks++;
    else if (l.startsWith('#')) headers++;
    else if (l.startsWith('- ') || l.startsWith('* ') || /^\d+\.\s/.test(l)) listItems++;
  }

  const markdownDensity = Math.min((codeBlocks + headers + listItems) * 5, 50);

  // ---- SPA Shell Penalty ----
  let spaShellPenalty = 0;
  for (const pattern of SPA_SHELL_PATTERNS) {
    if (pattern.test(trimmed)) {
      spaShellPenalty -= 40; // -40 per matched pattern, up to -200
    }
  }
  spaShellPenalty = Math.max(spaShellPenalty, -200);

  // ---- Captcha Penalty ----
  let captchaPenalty = 0;
  for (const pattern of CAPTCHA_PATTERNS) {
    if (pattern.test(trimmed)) {
      captchaPenalty -= 75; // -75 per matched pattern, up to -300
    }
  }
  captchaPenalty = Math.max(captchaPenalty, -300);

  // ---- Total ----
  const total = Math.max(
    0,
    contentLength + titlePresent + mainElement + markdownDensity + spaShellPenalty + captchaPenalty
  );

  return {
    total,
    contentLength,
    titlePresent,
    mainElement,
    markdownDensity,
    spaShellPenalty,
    captchaPenalty,
    acceptable: total >= threshold,
  };
}
```

### Step 3: Integrate into `lib/enrichment/index.ts`

Replace the current binary check at line 459:

```typescript
// BEFORE (old):
if (enrichment.content.rawText.length > 200) {
  scrapedTool.rawText = enrichment.content.rawText;
  contentSource = 'enrichment';
  console.log(`    ✅ [Pipeline] Enriched raw text (${enrichment.content.rawText.length} chars) from ${scrapedTool.websiteUrl} (source: ${enrichment.content.source})`);
}

// AFTER (new):
import { scoreContentQuality } from '@/lib/scrape/validate';

// ... in the enrichTool integration block:
const score = scoreContentQuality(enrichment.content.rawText, {
  fromMainElement: enrichment.content.source === 'direct-fetch', // direct-fetch uses Cheerio with main/article extraction
});

if (score.acceptable) {
  scrapedTool.rawText = enrichment.content.rawText;
  contentSource = 'enrichment';
  console.log(`    ✅ [Pipeline] Enriched raw text (score: ${score.total}, ${enrichment.content.rawText.length} chars) from ${scrapedTool.websiteUrl} (source: ${enrichment.content.source})`);
} else {
  console.log(`    ⏭️  [Pipeline] Enriched content below quality threshold (score: ${score.total}) for ${scrapedTool.websiteUrl} — keeping detail page text`);
}
```

**Important:** The integration in `lib/enrichment/index.ts` must import the scoring function. However, `lib/enrichment/index.ts` should not directly import from `@/lib/scrape/validate` to avoid a dependency inversion. Instead, **the scoring call should be in `lib/scrape/pipeline.ts`** where the enrichment is consumed. This keeps the enrichment module independent of scrape-specific validation logic.

Preferred integration approach — update `lib/scrape/pipeline.ts` where enrichment is consumed:

```typescript
// In pipeline.ts, around line 449-473:
import { scoreContentQuality } from './validate';

// ... inside the per-tool processing loop, after enrichment returns:
if (enrichment.content) {
  const enrichedScore = scoreContentQuality(enrichment.content.rawText, {
    fromMainElement: enrichment.content.source === 'direct-fetch',
  });

  if (enrichedScore.acceptable) {
    scrapedTool.rawText = enrichment.content.rawText;
    contentSource = 'enrichment';
    console.log(`    ✅ [Pipeline] Enriched raw text (score: ${enrichedScore.total}, ${enrichment.content.rawText.length} chars) from ${scrapedTool.websiteUrl} (source: ${enrichment.content.source})`);
  } else {
    console.log(`    ⏭️  [Pipeline] Enriched content below threshold (score: ${enrichedScore.total}) for ${scrapedTool.websiteUrl} — keeping detail text`);
  }

  // imageUrl resolution (unchanged)...
}
```

Move the scoring call to `pipeline.ts` and remove it from `enrichment/index.ts`. The integration point is **pipeline.ts lines 449-473** where enrichment results are consumed.

### Step 4: Update `.env.example` (optional)

Add an optional entry:

```
# Content scoring threshold (default 150)
CONTENT_SCORE_THRESHOLD=150
```

## Security Requirements

- The scoring function is pure and server-side only.
- No input from the client is passed to the scoring function — it operates on server-fetched content.
- No changes to admin secret or credential handling.

## Acceptance Criteria

1. `ContentScore` and `ScoreOptions` types are defined in `lib/scrape/types.ts`.
2. `scoreContentQuality()` function exists in `lib/scrape/validate.ts`.
3. Function returns correct component scores for various inputs:
   - Empty string → all zeros, `acceptable: false`.
   - Normal content (1000+ chars, no SPA/captcha patterns) → `acceptable: true`.
   - SPA shell content ("Loading...", JavaScript errors) → `acceptable: false` (penalized below threshold).
   - Captcha page content ("Checking your browser") → `acceptable: false` (heavily penalized).
4. Integration point in `lib/scrape/pipeline.ts` uses `scoreContentQuality()` instead of `content.length > 200`.
5. `DEFAULT_SCORE_THRESHOLD` reads from `CONTENT_SCORE_THRESHOLD` env var with fallback to 150.
6. All existing validation in `validateToolContent()` remains unchanged.
7. `npm run typecheck` passes with zero errors.
8. `npm run lint` passes with zero new errors.

## Checks to Run

- `npm run typecheck` — TypeScript no-emit
- `npm run lint` — ESLint
- `npm run build` — Next.js production build

## Exact Manual Test Steps

1. Run `npm run dev`.
2. Trigger a scrape: `curl -X POST http://localhost:3000/api/scrape -H "x-devscout-admin-secret: YOUR_SECRET" -H "Content-Type: application/json" -d '{"sourceIds": ["<a-source-uuid>"], "perSourceLimit": 1}'`
3. Watch terminal for scoring output:
   - `✅ [Pipeline] Enriched raw text (score: XX, YYYY chars) from https://...` for good content
   - `⏭️  [Pipeline] Enriched content below threshold (score: XX) for https://...` for low-quality content
4. Test with a tool website that returns a captcha/blocked page — verify the captcha penalty triggers and the enrichment is skipped.
5. Temporarily set `CONTENT_SCORE_THRESHOLD=300` in `.env.local` and restart — verify higher threshold causes more content to be rejected.
6. Remove `CONTENT_SCORE_THRESHOLD` and restart — verify default of 150 is used.
