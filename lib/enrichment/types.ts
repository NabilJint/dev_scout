// lib/enrichment/types.ts
// Types for the tool website enrichment pipeline

/**
 * Simplified enrichment content result for a single enrichment attempt.
 * This is the primary output type of the enrichTool orchestrator.
 */
export interface EnrichedContent {
  /** The tool's website URL */
  websiteUrl: string;

  /** Page title from <title> or og:title */
  title: string;

  /** Meta description or og:description */
  description: string;

  /** Open Graph image URL (hero/screenshot from tool site) */
  ogImage: string | null;

  /** Cleaned body text suitable for AI analysis */
  rawText: string;

  /** How the content was obtained */
  source: 'direct-fetch' | 'jina-reader' | 'failed';
}

/**
 * Enriched LogoResult with additional source types used by the enrichment tier.
 */
export interface EnrichedLogoResult {
  logoUrl: string | null;
  source: 'simpleicons' | 'og-image' | 'favicon' | 'none';
}

/**
 * Result of resolving and fetching a tool's website.
 * Contains structured content extracted from the tool's own website,
 * NOT from a discovery source (PH, HN, GitHub Trending).
 */
export interface ResolvedWebsite {
  /** The tool's website URL (normalized, https) */
  websiteUrl: string;

  /** Page title from <title> or og:title */
  title: string;

  /** Meta description or og:description */
  description: string;

  /** Open Graph image URL (hero/screenshot from tool site, not source page) */
  imageUrl: string;

  /** Cleaned body text suitable for AI analysis */
  rawText: string;

  /** ISO date string of when the page was last updated (if found) */
  lastUpdated: string;

  /** Whether the resolved content meets the minimum quality bar */
  quality: 'good' | 'minimal' | 'failed';
}

/**
 * Configuration for direct HTTP fetch behavior.
 */
export interface FetchConfig {
  /** User-Agent header value */
  userAgent: string;

  /** Timeout in milliseconds (default 10000) */
  timeoutMs: number;

  /** Maximum number of redirects to follow (default 5) */
  maxRedirects: number;

  /** Delay in ms between fetches for rate limiting (default 500) */
  rateLimitDelayMs: number;

  /** Acceptable content types for a successful fetch */
  acceptableContentTypes: RegExp[];
}

/**
 * Result of fetching a tool website URL.
 */
export interface WebsiteFetchResult {
  success: boolean;
  html: string;
  statusCode: number;
  finalUrl: string;
  error?: string;
  contentType?: string;
}

/**
 * Logo resolution result from SimpleIcons.
 */
export interface LogoResult {
  url: string | null;
  source: 'simpleicons' | 'registry' | 'favicon' | 'none';
}

/**
 * Enrichment attempt result for a single tool.
 */
export interface EnrichmentResult {
  toolCandidateId: string;  // index or identifier in the batch
  resolved: ResolvedWebsite | null;
  logo: LogoResult | null;
  duration: string;
  matchedExistingTool?: boolean; // whether website_url matched an existing tool
}

/**
 * Summary of an enrichment batch run.
 */
export interface EnrichmentSummary {
  status: 'completed' | 'partial' | 'failed';
  attempted: number;
  succeeded: number;
  failed: number;
  logosResolved: number;
  totalDuration: string;
  details: EnrichmentResult[];
}
