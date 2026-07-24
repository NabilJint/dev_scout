import 'server-only';

// lib/scrape/providers.ts
// Provider priority resolution — determines which fetch provider to use
// for a given source based on its provider_priority JSONB column.

import type { ProviderName, ProviderConfig, ProviderPriority } from './types';

/**
 * Default provider priority when none is configured on the source.
 */
const DEFAULT_PROVIDER_PRIORITY: ProviderName[] = ['http'];

/**
 * Parse a provider_priority value into an ordered array of ProviderConfig objects.
 * Normalizes both string-array and object-array formats.
 *
 * @param priority - Raw JSONB value from tool_sources.provider_priority
 * @returns Ordered array of ProviderConfig objects
 */
export function parseProviderPriority(priority: ProviderPriority): ProviderConfig[] {
  if (!priority || !Array.isArray(priority)) {
    return DEFAULT_PROVIDER_PRIORITY.map(p => ({ provider: p }));
  }

  if (priority.length === 0) {
    return DEFAULT_PROVIDER_PRIORITY.map(p => ({ provider: p }));
  }

  return priority.map(item => {
    if (typeof item === 'string') {
      // Simple string format: "http"
      return { provider: item as ProviderName };
    }
    // Object format: { provider: "http", timeout: 5000 }
    return item as ProviderConfig;
  });
}

/**
 * Get the primary (first) provider for a source.
 * This is the provider that should be tried first.
 */
export function getPrimaryProvider(priority: ProviderPriority): ProviderConfig {
  const providers = parseProviderPriority(priority);
  return providers[0];
}

/**
 * Check if a specific provider is configured in the priority list.
 */
export function hasProvider(priority: ProviderPriority, name: ProviderName): boolean {
  const providers = parseProviderPriority(priority);
  return providers.some(p => p.provider === name);
}