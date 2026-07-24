import 'server-only';

// lib/enrichment/jina-fallback.ts
// Jina Reader API fallback for fetching tool website content.
// Used when direct HTTP fetch fails (e.g., blocked by Cloudflare, SPA shells).
// Calls https://r.jina.ai/{url} which returns markdown with metadata headers.

import type { EnrichedContent } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const JINA_BASE = 'https://r.jina.ai';
const DEFAULT_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Jina Reader fetch
// ---------------------------------------------------------------------------

/**
 * Fetch a tool's website content via the Jina Reader API.
 *
 * Jina Reader returns clean markdown with structured headers:
 *   Title: ...
 *   URL Source: ...
 *   Description: ...
 *   (body content follows as markdown)
 *
 * @param url - The tool's website URL to fetch
 * @returns EnrichedContent or null if the fetch fails
 */
export async function fetchViaJina(url: string): Promise<EnrichedContent | null> {
  const jinaUrl = `${JINA_BASE}/${encodeURI(url)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(jinaUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/plain, text/markdown, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; DevScoutBot/1.0; +https://devscout.ai)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`  ⚠️  [Jina] HTTP ${response.status} for ${url}`);
      return null;
    }

    const text = await response.text();

    if (!text || text.length < 100) {
      console.warn(`  ⚠️  [Jina] Response too short (${text?.length ?? 0} chars) for ${url}`);
      return null;
    }

    return parseJinaResponse(text, url);
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn(`  ⚠️  [Jina] Timeout (${DEFAULT_TIMEOUT_MS}ms) for ${url}`);
    } else {
      console.warn(`  ⚠️  [Jina] Error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return null;
  }
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

/**
 * Parse the Jina Reader markdown response into structured content.
 *
 * Example response format:
 *   Title: Cursor - AI Code Editor
 *   URL Source: https://cursor.com
 *   Description: The AI-first code editor...
 *   Markdown content body...
 */
function parseJinaResponse(text: string, originalUrl: string): EnrichedContent {
  const lines = text.split('\n');
  let title = '';
  let description = '';
  let bodyStartIndex = 0;

  // Parse header lines (first ~10 lines)
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i].trim();

    if (line.startsWith('Title:')) {
      title = line.slice(6).trim();
    } else if (line.startsWith('Description:')) {
      description = line.slice(12).trim();
    } else if (line.startsWith('URL Source:')) {
      // Skip — we know the URL
      continue;
    } else if (line === '---' || line.startsWith('### ')) {
      // Separator or markdown heading — body starts after
      bodyStartIndex = i + 1;
      break;
    } else if (line === '') {
      // Empty line in header section — continue
      continue;
    } else if (i > 3 && !line.startsWith('Title:') && !line.startsWith('URL Source:') && !line.startsWith('Description:')) {
      // If we've passed the expected headers and hit non-header content, body starts here
      bodyStartIndex = i;
      break;
    }
  }

  // If no explicit body start found, assume after line 10
  if (bodyStartIndex === 0) {
    bodyStartIndex = Math.min(10, lines.length);
  }

  // Extract body content
  const bodyLines = lines.slice(bodyStartIndex);
  const bodyText = bodyLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Strip markdown links, keep text
    .trim();

  // If title wasn't in headers, try the first markdown heading
  if (!title) {
    const headingMatch = bodyText.match(/^#\s+(.+)/m);
    if (headingMatch) {
      title = headingMatch[1].trim();
    }
  }

  // If description wasn't in headers, use the first paragraph
  if (!description) {
    const firstParagraph = bodyText.split('\n\n').find(p => p.trim().length > 50);
    if (firstParagraph) {
      description = firstParagraph.replace(/^#+\s*/, '').trim().slice(0, 300);
    }
  }

  // Extract OG image from any image references in the markdown
  const imageMatch = bodyText.match(/!\[.*?\]\((.+?)\)/);
  const ogImage = imageMatch ? imageMatch[1] : null;

  return {
    websiteUrl: originalUrl,
    title,
    description,
    ogImage,
    rawText: bodyText,
    source: 'jina-reader',
  };
}
