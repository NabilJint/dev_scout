# Prompt: E7 — Fetch Abstraction Layer

## Goal

Create a `lib/fetch/` abstraction module that wraps three existing content-fetch providers (HTTP direct, Oxylabs, Jina) behind a unified interface. Replace the inline `fetchWithProviderPriority()` in `lib/scrape/pipeline.ts` with `fetchUrl()` from the new module. This decouples provider selection logic from the pipeline, making provider strategy reusable across scraping, enrichment, and scheduler.

## Assigned Specialist Agent(s)

- **Backend Engineer** (primary — create module, refactor pipeline.ts)
- **Code Reviewer** (review diff)
- **QA Engineer** (run checks)

## Skills Read

- `supabase` — for understanding existing query and type patterns
- Existing `AGENTS.md` — Sections 5 (architecture layers), 9 (pipeline rules), 21 (code standards)

## Existing Code Inspected

- `lib/scrape/pipeline.ts` — `fetchWithProviderPriority()` function (lines 163-219)
- `lib/scrape/types.ts` — `ProviderName`, `ProviderConfig`, `ProviderPriority`, `PipelineStage`
- `lib/scrape/providers.ts` — `parseProviderPriority()`, `getPrimaryProvider()`, `hasProvider()`
- `lib/scrape/oxylabs.ts` — `scrapeUrl()` interface and timeout (45s)
- `lib/enrichment/resolve-website.ts` — `resolveWebsite()` interface and timeout (10s)
- `lib/enrichment/jina-fallback.ts` — `fetchViaJina()` interface and timeout (15s)
- `lib/enrichment/index.ts` — `enrichTool()` and `fetchWebsiteContent()` patterns
- `lib/scrape/scheduler.ts` — how `processHomepageContent` is called with HTML already fetched

## Decisions or Assumptions

1. **Default priority when `null` is `['oxylabs']`** — this matches the existing default behavior in pipeline.ts line 172-176 where sources without `provider_priority` fall back to Oxylabs with optional render. This is a change from `providers.ts` where default is `['http']` — the fetch abstraction is specifically for the scrape pipeline where Oxylabs is the primary provider.
2. **Each adapter wraps the existing function** — no logic is duplicated. The adapter simply calls the existing function and normalizes the return type.
3. **Timeouts are per-provider** — HTTP 10s, Oxylabs 30s, Jina 15s. These are applied via `AbortSignal.timeout()` inside each adapter, respecting the existing timeout defaults.
4. **The fetch abstraction is additive** — existing `scrapeUrl()`, `resolveWebsite()`, and `fetchViaJina()` remain unchanged and usable directly.
5. **`fetchUrl()` returns a standardized `FetchResult`** — `{ content: string | null, provider: string, error?: string }` so the caller knows which provider succeeded.
6. **Do NOT rename or restructure** existing provider files. The abstraction imports them.

## Files Likely to Change

| File | Change |
|------|--------|
| `lib/fetch/types.ts` | **Create** — `FetchMethod`, `FetchResult`, `FetchOptions`, `FetchProvider` interface |
| `lib/fetch/index.ts` | **Create** — `fetchUrl(url, priority[], options?)` orchestrator |
| `lib/fetch/providers/http.ts` | **Create** — adapter wrapping `resolveWebsite()` |
| `lib/fetch/providers/oxylabs.ts` | **Create** — adapter wrapping `scrapeUrl()` |
| `lib/fetch/providers/jina.ts` | **Create** — adapter wrapping `fetchViaJina()` |
| `lib/scrape/pipeline.ts` | **Modify** — replace `fetchWithProviderPriority()` with `fetchUrl()` import |

## Implementation Requirements

### Step 1: Create `lib/fetch/types.ts`

```typescript
import 'server-only';

// lib/fetch/types.ts
// Shared types for the fetch abstraction layer

/**
 * Known fetch provider names.
 */
export type FetchProviderName = 'http' | 'oxylabs' | 'jina';

/**
 * Standardized result from any fetch provider.
 */
export interface FetchResult {
  /** The fetched HTML/content, or null if the fetch failed. */
  content: string | null;
  /** Which provider successfully returned content, or 'none' if all failed. */
  provider: FetchProviderName | 'none';
  /** Error message if the fetch failed. */
  error?: string;
  /** HTTP status code if applicable. */
  statusCode?: number;
}

/**
 * Options for the fetch orchestrator.
 */
export interface FetchOptions {
  /** Per-provider timeout overrides in milliseconds. */
  timeouts?: Partial<Record<FetchProviderName, number>>;
  /** Whether Oxylabs should use JS rendering. */
  render?: boolean;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

/**
 * A fetch provider adapter.
 */
export interface FetchProvider {
  readonly name: FetchProviderName;
  fetch(url: string, options?: FetchOptions): Promise<FetchResult>;
}
```

### Step 2: Create `lib/fetch/providers/http.ts`

Adapter wrapping `lib/enrichment/resolve-website.ts`:

```typescript
import 'server-only';
import type { FetchProvider, FetchResult, FetchOptions } from '../types';

const DEFAULT_HTTP_TIMEOUT = 10_000;

export const httpProvider: FetchProvider = {
  name: 'http',

  async fetch(url: string, options?: FetchOptions): Promise<FetchResult> {
    const timeoutMs = options?.timeouts?.http ?? DEFAULT_HTTP_TIMEOUT;

    try {
      const { resolveWebsite } = await import('@/lib/enrichment/resolve-website');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const result = await resolveWebsite(url);

      clearTimeout(timeoutId);

      if (result && result.quality !== 'failed') {
        return {
          content: result.rawText,
          provider: 'http',
          statusCode: 200,
        };
      }

      return {
        content: null,
        provider: 'http',
        error: result ? `Quality: ${result.quality}` : 'resolveWebsite returned null',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: null,
        provider: 'http',
        error: message,
      };
    }
  },
};
```

- Import `FetchProvider`, `FetchResult`, `FetchOptions` from `../types`
- Dynamic import of `resolveWebsite` (matches existing pattern in pipeline.ts line 182)
- Timeout of 10s via `AbortSignal.timeout` or controller pattern
- Return `content: result.rawText` on success
- Return `content: null, error: ...` on failure

### Step 3: Create `lib/fetch/providers/oxylabs.ts`

Adapter wrapping `lib/scrape/oxylabs.ts`:

```typescript
import 'server-only';
import type { FetchProvider, FetchResult, FetchOptions } from '../types';

const DEFAULT_OXYLABS_TIMEOUT = 30_000;

export const oxylabsProvider: FetchProvider = {
  name: 'oxylabs',

  async fetch(url: string, options?: FetchOptions): Promise<FetchResult> {
    const timeoutMs = options?.timeouts?.oxylabs ?? DEFAULT_OXYLABS_TIMEOUT;

    try {
      const { scrapeUrl } = await import('@/lib/scrape/oxylabs');
      const result = await scrapeUrl(url, {
        render: options?.render,
      });

      if (!result.error && result.content) {
        return {
          content: result.content,
          provider: 'oxylabs',
          statusCode: result.statusCode,
        };
      }

      return {
        content: null,
        provider: 'oxylabs',
        error: result.error || 'Oxylabs returned empty content',
        statusCode: result.statusCode,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: null,
        provider: 'oxylabs',
        error: message,
      };
    }
  },
};
```

- Import `FetchProvider`, `FetchResult`, `FetchOptions` from `../types`
- Dynamic import of `scrapeUrl` from `@/lib/scrape/oxylabs`
- Pass `options.render` through for JS rendering support
- Timeout of 30s — less than Oxylabs' internal 45s timeout
- Return standardized `FetchResult`

### Step 4: Create `lib/fetch/providers/jina.ts`

Adapter wrapping `lib/enrichment/jina-fallback.ts`:

```typescript
import 'server-only';
import type { FetchProvider, FetchResult, FetchOptions } from '../types';

const DEFAULT_JINA_TIMEOUT = 15_000;

export const jinaProvider: FetchProvider = {
  name: 'jina',

  async fetch(url: string, options?: FetchOptions): Promise<FetchResult> {
    const timeoutMs = options?.timeouts?.jina ?? DEFAULT_JINA_TIMEOUT;

    try {
      const { fetchViaJina } = await import('@/lib/enrichment/jina-fallback');
      const result = await fetchViaJina(url);

      if (result && result.rawText) {
        return {
          content: result.rawText,
          provider: 'jina',
          statusCode: 200,
        };
      }

      return {
        content: null,
        provider: 'jina',
        error: 'fetchViaJina returned null',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: null,
        provider: 'jina',
        error: message,
      };
    }
  },
};
```

- Import `FetchProvider`, `FetchResult`, `FetchOptions` from `../types`
- Dynamic import of `fetchViaJina` from `@/lib/enrichment/jina-fallback`
- Timeout of 15s (same as Jina's internal default)
- Return standardized `FetchResult`

### Step 5: Create `lib/fetch/index.ts`

The orchestrator that selects and iterates through providers:

```typescript
import 'server-only';

// lib/fetch/index.ts
// Fetch abstraction orchestrator.
// Iterates through providers in priority order until one succeeds.

import type { FetchProviderName, FetchResult, FetchOptions } from './types';
import { httpProvider } from './providers/http';
import { oxylabsProvider } from './providers/oxylabs';
import { jinaProvider } from './providers/jina';

/**
 * Map of provider name to provider implementation.
 */
const PROVIDER_MAP: Record<FetchProviderName, { fetch: (url: string, options?: FetchOptions) => Promise<FetchResult> }> = {
  http: httpProvider,
  oxylabs: oxylabsProvider,
  jina: jinaProvider,
};

/**
 * Default provider priority when none is specified.
 * ['oxylabs'] matches the existing pipeline default behavior.
 */
const DEFAULT_PRIORITY: FetchProviderName[] = ['oxylabs'];

/**
 * Fetch a URL by iterating through providers in priority order.
 *
 * @param url - The URL to fetch.
 * @param priority - Ordered array of provider names to try. Defaults to ['oxylabs'].
 * @param options - Optional per-provider timeouts, render flag, abort signal.
 * @returns FetchResult from the first successful provider, or last failure.
 */
export async function fetchUrl(
  url: string,
  priority?: FetchProviderName[],
  options?: FetchOptions
): Promise<FetchResult> {
  const providers = (priority && priority.length > 0) ? priority : DEFAULT_PRIORITY;

  let lastResult: FetchResult = {
    content: null,
    provider: 'none',
    error: 'All providers failed',
  };

  for (const providerName of providers) {
    const provider = PROVIDER_MAP[providerName];
    if (!provider) {
      console.warn(`  ⚠️  [Fetch] Unknown provider "${providerName}" — skipping`);
      continue;
    }

    console.log(`  📡 [Fetch] Trying ${providerName} for ${url}...`);
    const result = await provider.fetch(url, options);

    if (result.content !== null && !result.error) {
      console.log(`  ✅ [Fetch] ${providerName} succeeded for ${url}`);
      return result;
    }

    console.log(`  ⏭️  [Fetch] ${providerName} failed for ${url}: ${result.error}`);
    lastResult = result;
  }

  return lastResult;
}

// Re-export types for consumers
export type { FetchProviderName, FetchResult, FetchOptions } from './types';
```

- Import all three providers
- Map provider names to implementations
- Default priority `['oxylabs']` for backward compatibility with pipeline
- Iterate and return first successful result
- Log each attempt for console traceability

### Step 6: Refactor `lib/scrape/pipeline.ts`

Replace `fetchWithProviderPriority()` with `fetchUrl()`:

1. **Add import** at top:
   ```typescript
   import { fetchUrl } from '@/lib/fetch';
   import type { FetchProviderName } from '@/lib/fetch';
   ```

2. **Remove** the entire `fetchWithProviderPriority()` function (lines 163-219).

3. **Replace the homepage fetch call** (line 268) with:
   ```typescript
   const homepageResult = await fetchUrl(source.listing_url, undefined, { render: sourceNeedsRender(strategy) });
   ```

4. **Replace the detail page fetch call** (line 557) with:
   ```typescript
   const detailResult = await fetchUrl(candidate.url, undefined, { render: true });
   ```

5. **Update the response type handling** — `fetchUrl` returns `FetchResult` with `content` (string | null), `provider`, `error`, `statusCode`. Update the downstream checks:
   - `homepageResult.error` → `homepageResult.error`
   - `homepageResult.content` → `homepageResult.content`
   - `detailResult.error` → `detailResult.error`
   - `detailResult.content` → `detailResult.content`

   The existing checks are already compatible since both interfaces have `content`, `error`.

6. **Keep all existing logic** — `processHomepageContent()`, `runScrapePipeline()`, validation, logging, and stage tracking remain unchanged. Only the fetch mechanism is swapped.

## Security Requirements

- All files in `lib/fetch/` must start with `import 'server-only';`
- No browser-exposed code — this is a server-only module consumed by server-only pipelines
- Oxylabs credentials and API keys remain in `lib/scrape/oxylabs.ts` and `lib/enrichment/jina-fallback.ts` — the adapters never handle credentials directly

## Acceptance Criteria

1. `lib/fetch/types.ts` exists with `FetchProviderName`, `FetchResult`, `FetchOptions`, `FetchProvider` interfaces
2. `lib/fetch/providers/http.ts` exists and wraps `resolveWebsite()` with 10s timeout
3. `lib/fetch/providers/oxylabs.ts` exists and wraps `scrapeUrl()` with 30s timeout, passes `render` option
4. `lib/fetch/providers/jina.ts` exists and wraps `fetchViaJina()` with 15s timeout
5. `lib/fetch/index.ts` exists with `fetchUrl()` that iterates priority list, defaults to `['oxylabs']`
6. `lib/scrape/pipeline.ts` no longer has `fetchWithProviderPriority()` — uses `fetchUrl()` instead
7. All existing console logs, stage logs, and error handling in pipeline.ts remain unchanged
8. `npm run typecheck` passes with zero errors
9. `npm run lint` passes with zero new errors
10. `npm run build` passes

## Checks to Run

- `npm run typecheck` — TypeScript, no emit
- `npm run lint` — ESLint
- `npm run build` — Next.js production build (routes/config changed)

## Exact Manual Test Steps

1. Run `npm run dev` and watch the terminal.
2. Make a POST request to scrape a source:
   ```bash
   curl -X POST http://localhost:3000/api/scrape \
     -H "Content-Type: application/json" \
     -H "x-devscout-admin-secret: YOUR_ADMIN_SECRET" \
     -d '{"sourceNames": ["producthunt"], "perSourceLimit": 2}'
   ```
3. Observe the console logs: each fetch attempt should show `[Fetch] Trying oxylabs for <url>...` then `[Fetch] oxylabs succeeded`.
4. Verify the pipeline completes and returns a summary with tools inserted.
5. Run `npm run typecheck && npm run lint && npm run build` — all must pass.
