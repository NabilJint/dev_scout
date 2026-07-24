import 'server-only';
import type { FetchProvider, FetchResult, FetchOptions } from '../types';

const DEFAULT_OXYLABS_TIMEOUT = 30_000;

export const oxylabsProvider: FetchProvider = {
  name: 'oxylabs',

  async fetch(url: string, options?: FetchOptions): Promise<FetchResult> {
    const timeoutMs = options?.timeouts?.oxylabs ?? DEFAULT_OXYLABS_TIMEOUT;
    void timeoutMs; // documented timeout — scrapeUrl has its own internal 45s timeout with retries

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
