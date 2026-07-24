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
