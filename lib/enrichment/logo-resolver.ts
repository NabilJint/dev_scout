import 'server-only';

// lib/enrichment/logo-resolver.ts
// Three-tier brand logo resolution for developer tools.
//
// Tier 1: cdn.simpleicons.org — free SVG brand icon CDN, ~3100 icons
// Tier 2: Manual logo registry — for tools not on SimpleIcons
// Tier 3: Favicon extraction from tool website — last resort
//
// Per ADR-005: SimpleIcons Logo Enrichment

import type { LogoResult } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIMPLEICONS_BASE = 'https://cdn.simpleicons.org';

/**
 * Tools known to NOT be on SimpleIcons, with their verified logo URLs.
 * Extension point: add entries here as new tools are curated.
 */
const LOGO_REGISTRY: Record<string, string> = {
  'triggerdev': 'https://cdn.simpleicons.org/triggerdev',         // SVG available
  'inngest': 'https://cdn.simpleicons.org/inngest',               // SVG available
  'coolify': 'https://cdn.simpleicons.org/coolify',               // SVG available
  'planetscale': 'https://cdn.simpleicons.org/planetscale',        // SVG available
};

// ---------------------------------------------------------------------------
// Name normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a tool name for SimpleIcons lookup.
 *
 * SimpleIcons uses lowercase, no-special-chars, no-leading-digits paths.
 * Examples:
 *   "Cursor"    → "cursor"
 *   "PlanetScale" → "planetscale"
 *   "Trigger.dev" → "triggerdev"
 *   "Prisma"    → "prisma"
 */
export function normalizeForSimpleIcons(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^[0-9]+/, '');
}

/**
 * Normalize a tool name for registry lookup.
 * Strips everything except lowercase letters and digits.
 */
function normalizeForRegistry(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// Tier 1: SimpleIcons
// ---------------------------------------------------------------------------

/**
 * Check if an icon exists on SimpleIcons via a HEAD request.
 * SimpleIcons returns 200 for existing icons, 404 for missing ones.
 */
async function checkSimpleIcons(normalizedName: string): Promise<string | null> {
  const url = `${SIMPLEICONS_BASE}/${normalizedName}`;

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return url;
    }

    // Try with a hyphen-separated variant (e.g., "framer-motion" → "framer")
    if (normalizedName.includes('-')) {
      const baseName = normalizedName.split('-')[0];
      const baseUrl = `${SIMPLEICONS_BASE}/${baseName}`;
      const retryResponse = await fetch(baseUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      });
      if (retryResponse.ok) {
        return baseUrl;
      }
    }

    return null;
  } catch {
    // Network error — non-critical
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tier 2: Logo Registry
// ---------------------------------------------------------------------------

function checkRegistry(normalizedName: string): string | null {
  return LOGO_REGISTRY[normalizedName] ?? null;
}

// ---------------------------------------------------------------------------
// Tier 3: Favicon extraction
// ---------------------------------------------------------------------------

/**
 * Extract favicon URL from a tool website.
 * Checks standard locations:
 *   <link rel="icon">, <link rel="shortcut icon">, /favicon.ico
 */
async function extractFavicon(websiteUrl: string): Promise<string | null> {
  try {
    const response = await fetch(websiteUrl, {
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DevScoutBot/1.0)',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const faviconMatch = html.match(
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i
    );

    if (faviconMatch) {
      let faviconUrl = faviconMatch[1];
      // Resolve relative URLs
      if (faviconUrl.startsWith('//')) {
        faviconUrl = `https:${faviconUrl}`;
      } else if (faviconUrl.startsWith('/')) {
        const base = new URL(websiteUrl);
        faviconUrl = `${base.origin}${faviconUrl}`;
      } else if (!faviconUrl.startsWith('http')) {
        const base = new URL(websiteUrl);
        faviconUrl = `${base.origin}/${faviconUrl}`;
      }
      return faviconUrl;
    }

    // Fall back to standard /favicon.ico location
    const base = new URL(websiteUrl);
    return `${base.origin}/favicon.ico`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main resolution function
// ---------------------------------------------------------------------------

/**
 * Three-tier logo resolution for a tool.
 *
 * Priority:
 *   1. SimpleIcons CDN (by tool name)
 *   2. Logo registry (manual overrides)
 *   3. Favicon from tool website (last resort)
 *
 * @param toolName - The tool's display name (e.g., "PlanetScale")
 * @param websiteUrl - The tool's website URL (optional, for favicon fallback)
 * @returns LogoResult with resolved URL and source
 */
export async function resolveLogo(
  toolName: string,
  websiteUrl?: string
): Promise<LogoResult> {
  const normalized = normalizeForSimpleIcons(toolName);
  const registryKey = normalizeForRegistry(toolName);

  // Tier 1: SimpleIcons
  try {
    const simpleiconsUrl = await checkSimpleIcons(normalized);
    if (simpleiconsUrl) {
      return { url: simpleiconsUrl, source: 'simpleicons' };
    }
  } catch {
    // Non-critical — continue to next tier
  }

  // Tier 2: Logo Registry
  const registryUrl = checkRegistry(registryKey);
  if (registryUrl) {
    return { url: registryUrl, source: 'registry' };
  }

  // Tier 3: Favicon (only if we have a website URL)
  if (websiteUrl) {
    try {
      const faviconUrl = await extractFavicon(websiteUrl);
      if (faviconUrl) {
        return { url: faviconUrl, source: 'favicon' };
      }
    } catch {
      // Non-critical
    }
  }

  return { url: null, source: 'none' };
}

/**
 * Resolve logos for multiple tools in parallel.
 *
 * @param tools - Array of { name, websiteUrl? } tuples
 * @param concurrency - Max concurrent lookups (default 5)
 * @returns Array of LogoResult
 */
export async function resolveLogos(
  tools: Array<{ name: string; websiteUrl?: string }>,
  concurrency = 5
): Promise<LogoResult[]> {
  const results: LogoResult[] = new Array(tools.length).fill({
    url: null,
    source: 'none',
  });
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tools.length) {
      const i = index++;
      const tool = tools[i];
      results[i] = await resolveLogo(tool.name, tool.websiteUrl);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tools.length) }, worker);
  await Promise.all(workers);

  return results;
}
