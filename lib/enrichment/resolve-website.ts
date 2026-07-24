import 'server-only';

// lib/enrichment/resolve-website.ts
// Server-only module for fetching and extracting content from a tool's
// actual website (e.g., cursor.com, supabase.com) via direct HTTP.
// Uses zero Oxylabs credits — standard Node.js fetch() + Cheerio parsing.

import * as cheerio from 'cheerio';
import { cleanRawText } from '@/lib/scrape/validate';
import type { ResolvedWebsite, WebsiteFetchResult } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_RATE_LIMIT_DELAY_MS = 500;

/**
 * User-Agent strings to rotate through (simple rotation, not stealth).
 */
const USER_AGENTS = [
  'Mozilla/5.0 (compatible; DevScoutBot/1.0; +https://devscout.ai)',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];

/**
 * Content types we consider acceptable for HTML page extraction.
 */
const ACCEPTABLE_CONTENT_TYPES = /^text\/html|^application\/xhtml\+xml|^text\/plain/i;

/**
 * Known non-product/shell response indicators — when a page has very low
 * content body length AND contains these, it's likely an SPA shell or
 * bot challenge page (Cloudflare, etc.).
 */
const SHELL_INDICATORS = [
  'cloudflare',
  'Checking your browser',
  'Just a moment',
  'Enable JavaScript',
];

// ---------------------------------------------------------------------------
// Stateful rate limiter
// ---------------------------------------------------------------------------

let lastFetchTime = 0;

/**
 * Ensure minimum delay between fetches to avoid triggering rate limits.
 */
async function rateLimitDelay(delayMs: number): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastFetchTime;
  if (elapsed < delayMs) {
    await new Promise(resolve => setTimeout(resolve, delayMs - elapsed));
  }
  lastFetchTime = Date.now();
}

// ---------------------------------------------------------------------------
// URL normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a website URL for fetching:
 * - Ensure https:// prefix
 * - Remove trailing slash (except root)
 * - Lowercase hostname
 * - Handle common redirect patterns
 */
export function normalizeWebsiteUrl(raw: string): string {
  let url = raw.trim();

  // Handle protocol-less URLs
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);

    // Force HTTPS
    parsed.protocol = 'https:';
    parsed.hash = '';

    // Remove trailing slash from path (keep root /)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Check if a URL looks like a tool website (not a blog, listing, or social page).
 * Returns the reason if rejected, undefined if it passes.
 */
function rejectNonToolWebsite(url: string): string | undefined {
  const knownNonToolPatterns = [
    /^https?:\/\/(?:www\.)?github\.com\/(?:[^/]+\/[^/]+)?\/?$/,  // GitHub repo
    /^https?:\/\/(?:www\.)?npmjs\.com\//,
    /^https?:\/\/(?:www\.)?pypi\.org\//,
    /^https?:\/\/(?:www\.)?rubygems\.org\//,
    /^https?:\/\/(?:www\.)?crates\.io\//,
    /^https?:\/\/(?:www\.)?producthunt\.com\//,
    /^https?:\/\/(?:www\.)?news\.ycombinator\.com\//,
    /^https?:\/\/(?:www\.)?reddit\.com\//,
    /^https?:\/\/(?:www\.)?dev\.to\//,
    /^https?:\/\/(?:www\.)?betalist\.com\//,
    /^https?:\/\/(?:www\.)?saashub\.com\//,
    /^https?:\/\/(?:www\.)?linkedin\.com\//,
    /^https?:\/\/(?:www\.)?twitter\.com\//,
    /^https?:\/\/(?:www\.)?x\.com\//,
    /^https?:\/\/(?:www\.)?youtube\.com\//,
    /^https?:\/\/(?:www\.)?medium\.com\//,
    /^https?:\/\/(?:www\.)?gitlab\.com\//,
    /^https?:\/\/(?:www\.)?bitbucket\.org\//,
  ];

  for (const pattern of knownNonToolPatterns) {
    if (pattern.test(url)) {
      return 'non_tool_website';
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

/**
 * Fetch a website URL with sensible defaults and error handling.
 * Returns structured result with success/failure, HTML, and metadata.
 */
export async function fetchWebsite(
  url: string,
  options?: {
    timeoutMs?: number;
    userAgent?: string;
    maxRedirects?: number;
  }
): Promise<WebsiteFetchResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const userAgent = options?.userAgent ?? USER_AGENTS[0];
  void (options?.maxRedirects ?? DEFAULT_MAX_REDIRECTS); // kept for API compatibility

  const normalizedUrl = normalizeWebsiteUrl(url);

  // Reject known non-tool URLs early
  const rejectReason = rejectNonToolWebsite(normalizedUrl);
  if (rejectReason) {
    return {
      success: false,
      html: '',
      statusCode: 0,
      finalUrl: normalizedUrl,
      error: `Rejected: ${rejectReason}`,
    };
  }

  // Apply rate limit delay
  await rateLimitDelay(DEFAULT_RATE_LIMIT_DELAY_MS);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    clearTimeout(timeoutId);

    const statusCode = response.status;
    const finalUrl = response.url;

    // Check for blocking responses
    if (statusCode === 403) {
      return {
        success: false, html: '', statusCode, finalUrl,
        error: 'Blocked (403) — likely Cloudflare or WAF',
      };
    }

    if (statusCode === 429) {
      return {
        success: false, html: '', statusCode, finalUrl,
        error: 'Rate limited (429)',
      };
    }

    if (statusCode >= 400) {
      return {
        success: false, html: '', statusCode, finalUrl,
        error: `HTTP ${statusCode}`,
      };
    }

    // Check content type
    const contentType = response.headers.get('content-type') || '';
    if (!ACCEPTABLE_CONTENT_TYPES.test(contentType)) {
      return {
        success: false, html: '', statusCode, finalUrl,
        error: `Unexpected content type: ${contentType}`,
        contentType,
      };
    }

    const html = await response.text();

    // Check for Cloudflare/bot challenge shell pages
    if (html.length < 2000 && SHELL_INDICATORS.some(indicator => html.includes(indicator))) {
      return {
        success: false, html: '', statusCode, finalUrl,
        error: 'Bot challenge page (Cloudflare or similar)',
        contentType,
      };
    }

    return {
      success: true,
      html,
      statusCode,
      finalUrl,
      contentType,
    };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        success: false, html: '', statusCode: 0, finalUrl: normalizedUrl,
        error: `Timeout (${timeoutMs}ms)`,
      };
    }

    return {
      success: false, html: '', statusCode: 0, finalUrl: normalizedUrl,
      error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Content extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract Open Graph data from HTML.
 */
function extractOpenGraph($: cheerio.CheerioAPI): {
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
} {
  return {
    ogTitle:
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      '',
    ogDescription:
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      '',
    ogImage:
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      '',
  };
}

/**
 * Extract last-updated date from HTML.
 */
function extractLastUpdated($: cheerio.CheerioAPI): string {
  const lastUpdated =
    $('meta[property="article:published_time"]').attr('content') ||
    $('meta[name="date"]').attr('content') ||
    $('meta[itemprop="datePublished"]').attr('content') ||
    $('time[datetime]').first().attr('datetime') ||
    new Date().toISOString();

  // Ensure ISO format
  if (!lastUpdated.includes('T')) {
    const parsed = new Date(lastUpdated);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return lastUpdated;
}

/**
 * Extract page title with multiple fallbacks.
 */
function extractTitle($: cheerio.CheerioAPI): string {
  return (
    $('meta[property="og:title"]').attr('content') ||
    $('h1').first().text().trim() ||
    $('title').first().text().trim() ||
    ''
  );
}

/**
 * Page-specific extraction for developer tool landing pages.
 * Targets the key content areas that marketing sites typically use.
 */
function extractLandingPageText($: cheerio.CheerioAPI): string {
  // Preferred content containers — most dev tool landing pages use these
  const contentSelectors = [
    // Hero sections
    'section[class*="hero"]',
    'section[class*="billboard"]',

    // Feature sections (most common for dev tools)
    'section[class*="feature"]',
    'section[class*="capability"]',

    // Product description sections
    'section[class*="product"]',
    'section[class*="about"]',
    'section[class*="overview"]',

    // Pricing
    'section[class*="pricing"]',

    // Use cases
    'section[class*="use-case"]',
    'section[class*="solution"]',

    // Documentation snippet areas
    'section[class*="code"]',
    'section[class*="snippet"]',

    // Generic content areas
    'main',
    'article',
    '[role="main"]',
    '.content',
    '#content',
    '.post-content',
  ];

  const textParts: string[] = [];

  for (const selector of contentSelectors) {
    $(selector).each((_i, el) => {
      // Skip if this element or its parent is part of a non-content element
      const $el = $(el);
      const parentClasses = $el.parent().attr('class') || '';
      if (
        parentClasses.includes('footer') ||
        parentClasses.includes('nav') ||
        parentClasses.includes('sidebar')
      ) {
        return;
      }

      const text = $el.text().trim();
      if (text.length > 50) {
        textParts.push(text);
      }
    });
  }

  // If no structured sections found, fall back to body
  if (textParts.length === 0) {
    const body = $('body').text().trim();
    if (body.length > 100) {
      textParts.push(body);
    }
  }

  return textParts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Quality assessment
// ---------------------------------------------------------------------------

/**
 * Assess whether resolved website content is good enough for AI analysis.
 */
function assessContentQuality(
  rawText: string,
  title: string,
  imageUrl: string
): ResolvedWebsite['quality'] {
  const cleanText = rawText.replace(/\s+/g, ' ').trim();

  // Good: meaningful product content, proper title, has image
  if (
    cleanText.length >= 500 &&
    title.length >= 3 &&
    imageUrl.length > 0 &&
    !GENERIC_PAGE_TITLES.has(title.toLowerCase().trim())
  ) {
    return 'good';
  }

  // Minimal: has some content but lacking image or short text
  if (cleanText.length >= 200) {
    return 'minimal';
  }

  return 'failed';
}

const GENERIC_PAGE_TITLES = new Set([
  'home', 'index', 'welcome', 'coming soon', 'under construction',
  'sign in', 'login', 'sign up', 'register', 'dashboard',
  '404', 'not found', 'page not found',
]);

// ---------------------------------------------------------------------------
// Main enrichment function
// ---------------------------------------------------------------------------

/**
 * Resolve a tool website URL by fetching it and extracting meaningful content.
 *
 * This is the primary entry point for the enrichment pipeline.
 *
 * @param websiteUrl - The tool's website URL (e.g., "https://cursor.com")
 * @returns ResolvedWebsite with extracted content, or null if resolution fails
 */
export async function resolveWebsite(
  websiteUrl: string
): Promise<ResolvedWebsite | null> {
  const normalizedUrl = normalizeWebsiteUrl(websiteUrl);

  // Attempt fetch (try up to 2 user agents on failure)
  let result: WebsiteFetchResult | null = null;
  let lastError: string | undefined;

  for (let attempt = 0; attempt < USER_AGENTS.length; attempt++) {
    result = await fetchWebsite(normalizedUrl, {
      userAgent: USER_AGENTS[attempt],
    });

    if (result.success) break;
    lastError = result.error;

    // Don't retry on 4xx errors other than 429
    if (result.statusCode >= 400 && result.statusCode !== 429) break;
  }

  if (!result || !result.success || !result.html) {
    console.warn(`  ⚠️  [Enrichment] Failed to fetch ${normalizedUrl}: ${lastError}`);
    return null;
  }

  // Parse HTML with Cheerio
  const $ = cheerio.load(result.html);
  const og = extractOpenGraph($);

  // Extract structured content from the landing page
  const pageText = extractLandingPageText($);

  // Clean it using the existing utility
  const rawText = cleanRawText(result.html);

  // Combine: prefer structured section text but ensure we have enough
  const finalText = pageText.length >= 300 ? pageText : rawText;

  // Extract metadata
  const title = og.ogTitle || extractTitle($);
  const description = og.ogDescription || '';
  const imageUrl = og.ogImage || '';
  const lastUpdated = extractLastUpdated($);

  // Assess quality
  const quality = assessContentQuality(finalText, title, imageUrl);

  console.log(
    `  ${quality === 'good' ? '✅' : quality === 'minimal' ? '⚠️' : '❌'} [Enrichment] Resolved ${normalizedUrl} — ${title} (${quality}, ${finalText.length} chars)`
  );

  return {
    websiteUrl: result.finalUrl,
    title,
    description,
    imageUrl,
    rawText: finalText,
    lastUpdated,
    quality,
  };
}

/**
 * Resolve a batch of tool website URLs in parallel.
 *
 * @param urls - Array of website URL strings
 * @param concurrency - Max concurrent fetches (default 3)
 * @returns Array of ResolvedWebsite or null
 */
export async function resolveWebsites(
  urls: string[],
  concurrency = 3
): Promise<(ResolvedWebsite | null)[]> {
  const results: (ResolvedWebsite | null)[] = new Array(urls.length).fill(null);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < urls.length) {
      const i = index++;
      const url = urls[i];
      if (url) {
        results[i] = await resolveWebsite(url);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, worker);
  await Promise.all(workers);

  return results;
}

/**
 * Extract a tool name from a website URL for SimpleIcons lookup.
 *
 * SimpleIcons uses lowercase, no-special-chars names.
 * E.g., "https://cursor.com" → "cursor"
 * "https://www.prisma.io" → "prisma"
 */
export function extractNameFromUrl(url: string): string {
  try {
    const parsed = new URL(normalizeWebsiteUrl(url));
    const hostname = parsed.hostname
      .replace(/^www\./, '')
      .replace(/\..+$/, '');
    return hostname.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
}
