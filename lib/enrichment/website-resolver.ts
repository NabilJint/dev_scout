import 'server-only';

// lib/enrichment/website-resolver.ts
// Resolves a tool's canonical website URL from scraped data.
// Chains multiple discovery methods to find the best URL.

import type { WebsiteResolution } from './types';

// ---------------------------------------------------------------------------
// Reject list — domains that are NOT official tool websites
// ---------------------------------------------------------------------------

const REJECTED_DOMAINS = [
  /^https?:\/\/(?:www\.)?github\.com\//i,
  /^https?:\/\/(?:www\.)?npmjs\.com\//i,
  /^https?:\/\/(?:www\.)?pypi\.org\//i,
  /^https?:\/\/(?:www\.)?rubygems\.org\//i,
  /^https?:\/\/(?:www\.)?crates\.io\//i,
  /^https?:\/\/(?:www\.)?producthunt\.com\//i,
  /^https?:\/\/(?:www\.)?reddit\.com\//i,
  /^https?:\/\/(?:www\.)?medium\.com\//i,
  /^https?:\/\/(?:www\.)?youtube\.com\//i,
  /^https?:\/\/(?:www\.)?youtu\.be\//i,
  /^https?:\/\/(?:www\.)?twitter\.com\//i,
  /^https?:\/\/(?:www\.)?x\.com\//i,
  /^https?:\/\/(?:www\.)?linkedin\.com\//i,
  /^https?:\/\/(?:www\.)?dev\.to\//i,
  /^https?:\/\/(?:www\.)?betalist\.com\//i,
  /^https?:\/\/(?:www\.)?saashub\.com\//i,
  /^https?:\/\/(?:www\.)?news\.ycombinator\.com\//i,
  /^https?:\/\/(?:www\.)?github\.blog\//i,
  /^https?:\/\/(?:.*\.)?imagekit\.io\//i,
  /^https?:\/\/(?:.*\.)?cloudinary\.com\//i,
  /^https?:\/\/(?:.*\.)?imgix\.net\//i,
  /^https?:\/\/(?:.*\.)?unsplash\.com\//i,
];

/**
 * Check if a URL is a rejected domain (not a valid official website).
 */
function isRejectedDomain(url: string): boolean {
  return REJECTED_DOMAINS.some(pattern => pattern.test(url));
}

/**
 * Normalize a website URL to a consistent format.
 */
function normalizeUrl(raw: string): string {
  let url = raw.trim();

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    parsed.protocol = 'https:';
    parsed.hash = '';
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Extract the hostname from a URL (for cross-domain comparison).
 */
function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// URL resolution methods
// ---------------------------------------------------------------------------

/**
 * Tier 1: Parser-extracted URL.
 * The source-specific parser already extracted a websiteUrl from the listing.
 * This is the most reliable source.
 */
function resolveFromParserUrl(parserUrl: string): WebsiteResolution | null {
  const normalized = normalizeUrl(parserUrl);

  if (isRejectedDomain(normalized)) {
    return null;
  }

  return {
    officialWebsite: normalized,
    githubUrl: normalized.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+\/[^/]+)/i)
      ? normalized.replace(/\/$/, '')
      : null,
    confidence: 1.0,
    method: 'parser-extracted',
  };
}

/**
 * Tier 2: Homepage link from scraped content.
 * Look for links in the raw text that point to a different domain
 * than the source listing URL.
 */
function resolveFromHomepageLink(
  rawText: string,
  sourceListingUrl: string
): WebsiteResolution | null {
  const sourceHostname = extractHostname(sourceListingUrl);
  if (!sourceHostname) return null;

  // Extract all URLs from raw text
  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
  const matches = rawText.match(urlRegex);
  if (!matches || matches.length === 0) return null;

  const sourceDomain = sourceHostname;

  // Find the first URL that's NOT on the same domain as the source
  // and is not on the rejected domains list
  for (const match of matches) {
    const targetHostname = extractHostname(match);
    if (!targetHostname) continue;
    if (targetHostname === sourceDomain) continue;
    if (isRejectedDomain(match)) continue;

    const normalized = normalizeUrl(match);

    return {
      officialWebsite: normalized,
      githubUrl: normalized.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+\/[^/]+)/i)
        ? normalized.replace(/\/$/, '')
        : null,
      confidence: 0.8,
      method: 'homepage-link',
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main resolver function
// ---------------------------------------------------------------------------

/**
 * Resolve a tool's official website URL from scraped data.
 *
 * Priority chain:
 *   1. Parser-extracted URL from candidate
 *   2. Homepage link from scraped content (different domain than source)
 *
 * @param params.parserUrl - URL extracted by the source parser (CandidateLink.websiteUrl)
 * @param params.rawText - Raw scraped text to search for homepage links
 * @param params.sourceListingUrl - The source's own listing URL (for cross-domain detection)
 * @returns WebsiteResolution with resolved URL and confidence
 */
export async function resolveWebsiteUrl(params: {
  parserUrl?: string | null;
  rawText?: string | null;
  sourceListingUrl?: string | null;
}): Promise<WebsiteResolution> {
  const { parserUrl, rawText, sourceListingUrl } = params;

  // Tier 1: Parser-extracted URL — most reliable
  if (parserUrl) {
    const result = resolveFromParserUrl(parserUrl);
    if (result) return result;
  }

  // Tier 2: Homepage link from scraped content
  if (rawText && sourceListingUrl) {
    const result = resolveFromHomepageLink(rawText, sourceListingUrl);
    if (result) return result;
  }

  return {
    officialWebsite: null,
    githubUrl: null,
    confidence: 0,
    method: 'none',
  };
}
