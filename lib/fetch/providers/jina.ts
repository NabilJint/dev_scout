import 'server-only';
import type { FetchProvider, FetchResult, FetchOptions } from '../types';

const DEFAULT_JINA_TIMEOUT = 15_000;

export const jinaProvider: FetchProvider = {
  name: 'jina',

  async fetch(url: string, options?: FetchOptions): Promise<FetchResult> {
    const timeoutMs = options?.timeouts?.jina ?? DEFAULT_JINA_TIMEOUT;
    void timeoutMs; // documented timeout — fetchViaJina has its own internal 15s timeout

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
