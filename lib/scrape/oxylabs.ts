import 'server-only';

// lib/scrape/oxylabs.ts
// Server-only Oxylabs Web Scraper API client
// Uses the Realtime endpoint for all scraping calls

/**
 * Scrape a URL through the Oxylabs Web Scraper API.
 *
 * Uses HTTP Basic Auth with OXY_WSA_USERNAME and OXY_WSA_PASSWORD.
 * Retries on 429 (rate limit) with exponential backoff (1s, 2s, 4s).
 * Fails fast on 401/403.
 * Retries once on network errors after 3s.
 */
export async function scrapeUrl(
  url: string,
  options?: { render?: boolean }
): Promise<{ content: string; statusCode: number; error?: string }> {
  const username = process.env.OXY_WSA_USERNAME;
  const password = process.env.OXY_WSA_PASSWORD;

  if (!username || !password) {
    return { content: '', statusCode: 0, error: 'Oxylabs credentials not configured' };
  }

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  const maxRetries = 3;
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const body: Record<string, unknown> = { source: 'universal', url };
      if (options?.render) {
        body.render = 'html';
      }

      const response = await fetch('https://realtime.oxylabs.io/v1/queries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 401) {
        return { content: '', statusCode: 401, error: 'Oxylabs authentication failed (401)' };
      }
      if (response.status === 403) {
        return { content: '', statusCode: 403, error: 'Oxylabs access denied (403)' };
      }

      if (response.status === 429) {
        lastError = `Rate limited (429) on attempt ${attempt + 1}`;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`  ⚠️  ${lastError}, retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return { content: '', statusCode: 429, error: lastError };
      }

      if (!response.ok) {
        return { content: '', statusCode: response.status, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      const result = data?.results?.[0];

      if (!result) {
        // Log the reason — this helps debug empty results (common with bad credentials / blocked pages)
        const snippet = JSON.stringify(data).slice(0, 500);
        console.error(`  ❌ [Oxylabs] No results array in response for ${url}: ${snippet}`);
        return { content: '', statusCode: 0, error: 'No results in Oxylabs response' };
      }

      const content = typeof result.content === 'string' ? result.content : '';
      const statusCode = result.status_code || 200;

      // Log non-OK status codes so source-level failures are visible in console
      if (statusCode >= 400) {
        console.warn(`  ⚠️  [Oxylabs] Non-OK status_code: ${statusCode} for ${url}`);
      }

      return {
        content,
        statusCode,
      };

    } catch (err) {
      lastError = `Network error: ${err instanceof Error ? err.message : String(err)}`;
      if (attempt < maxRetries) {
        console.warn(`  ⚠️  ${lastError}, retrying in 3s...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  return { content: '', statusCode: 0, error: lastError || 'Unknown error' };
}
