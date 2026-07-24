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
