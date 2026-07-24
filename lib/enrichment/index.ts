import 'server-only';

// lib/enrichment/index.ts
// Enrichment pipeline orchestrator.
// Runs AFTER a tool is discovered from a source page, but BEFORE AI analysis.
// Fetches the tool's actual website to get rich content for analysis.
//
// Integration points:
//   - lib/scrape/pipeline.ts → replaces detail page content with enriched content
//   - Can also run as standalone backfill for existing tools

export { resolveWebsite, resolveWebsites, normalizeWebsiteUrl, extractNameFromUrl } from './resolve-website';
export { resolveLogo, resolveLogos, normalizeForSimpleIcons } from './logo-resolver';
export { fetchViaJina } from './jina-fallback';
export type {
  ResolvedWebsite,
  EnrichmentResult,
  EnrichmentSummary,
  LogoResult,
  EnrichedContent,
  EnrichedLogoResult,
} from './types';

// Direct imports for local use (re-exports don't create local bindings)
import { resolveLogo } from './logo-resolver';
import type { EnrichedContent, LogoResult } from './types';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Sleep for the given number of milliseconds.
 * Used between requests to avoid rate limiting.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// enrichTool — the primary enrichment orchestrator
// ---------------------------------------------------------------------------

/**
 * Enrich a single tool by fetching its website content and resolving its logo.
 *
 * Strategy:
 *   1. Try direct HTTP fetch via `resolveWebsite` (Cheerio-based extraction)
 *   2. If that fails, try Jina Reader API (`fetchViaJina`)
 *   3. In parallel, always try to resolve the logo via `resolveLogo`
 *
 * @param params.name       - Tool display name (for logo resolution)
 * @param params.websiteUrl - Tool's website URL to fetch content from
 * @returns Object with `content` (EnrichedContent) and `logo` (LogoResult)
 */
export async function enrichTool(params: {
  name: string;
  websiteUrl: string;
}): Promise<{
  content: EnrichedContent | null;
  logo: LogoResult | null;
}> {
  const { name, websiteUrl } = params;

  if (!websiteUrl) {
    return { content: null, logo: null };
  }

  // Run logo resolution in parallel with content fetching
  const [contentResult] = await Promise.all([
    fetchWebsiteContent(websiteUrl),
    sleep(500), // Rate limit delay between requests
  ]);

  // Always try to resolve the logo
  const logo = await resolveLogo(name, websiteUrl);

  return {
    content: contentResult,
    logo: logo.source !== 'none' ? logo : null,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetch website content with a two-tier strategy:
 *   1. Direct HTTP fetch (via resolve-website)
 *   2. Jina Reader API fallback (via jina-fallback)
 */
async function fetchWebsiteContent(url: string): Promise<EnrichedContent | null> {
  const { resolveWebsite } = await import('./resolve-website');

  // Tier 1: Direct fetch
  try {
    const resolved = await resolveWebsite(url);
    if (resolved && resolved.quality !== 'failed') {
      return {
        websiteUrl: resolved.websiteUrl,
        title: resolved.title,
        description: resolved.description,
        ogImage: resolved.imageUrl || null,
        rawText: resolved.rawText,
        source: 'direct-fetch',
      };
    }
  } catch (err) {
    console.warn(`  ⚠️  [Enrichment] Direct fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Tier 2: Jina Reader fallback
  try {
    const { fetchViaJina } = await import('./jina-fallback');
    const jinaResult = await fetchViaJina(url);
    if (jinaResult) {
      return jinaResult;
    }
  } catch (err) {
    console.warn(`  ⚠️  [Enrichment] Jina fallback failed for ${url}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return null;
}
