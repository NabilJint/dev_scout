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
