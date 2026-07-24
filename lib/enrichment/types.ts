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

  /** Structured metadata extracted from the page's HTML. */
  metadata: PageMetadata | null;
}

/**
 * Structured metadata extracted from a tool's HTML page.
 * All fields are best-effort — null if not found.
 */
export interface PageMetadata {
  /** OpenGraph tags */
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogUrl: string | null;
  ogType: string | null;
  ogSiteName: string | null;

  /** Twitter Card tags */
  twitterCard: string | null;
  twitterSite: string | null;
  twitterCreator: string | null;

  /** Standard meta tags */
  metaDescription: string | null;
  metaKeywords: string | null;
  canonicalUrl: string | null;

  /** JSON-LD fields */
  jsonLdType: string | null;
  jsonLdName: string | null;
  jsonLdDescription: string | null;
  jsonLdLogo: string | null;
  jsonLdUrl: string | null;
  jsonLdApplicationCategory: string | null;
  jsonLdOperatingSystem: string | null;

  /** Raw JSON-LD blocks (unparsed, for debugging) */
  rawJsonLd: string[] | null;
}

/**
 * Enriched LogoResult with additional source types used by the enrichment tier.
 */
export interface EnrichedLogoResult {
  logoUrl: string | null;
  source: 'simpleicons' | 'og-image' | 'favicon' | 'none';
}

/**
 * Result of resolving a tool's canonical website URL.
 * Tracks the resolution method and confidence.
 */
export interface WebsiteResolution {
  /** The resolved official website URL, or null if not found. */
  officialWebsite: string | null;
  /** The detected GitHub repository URL, or null. */
  githubUrl: string | null;
  /** Confidence score 0-1. Higher means more reliable source. */
  confidence: number;
  /** Which method produced the result. */
  method: 'parser-extracted' | 'homepage-link' | 'github-homepage' | 'github-readme' | 'package-metadata' | 'none';
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
  source: 'og-image' | 'jsonld-logo' | 'header-svg' | 'simpleicons' | 'registry' | 'favicon' | 'none';
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

/**
 * Result of resolving a tool's GitHub repository data.
 */
export interface GitHubData {
  /** Full GitHub repository URL (e.g., "https://github.com/vercel/next.js") */
  repository: string | null;
  /** Repository owner (user or org name) */
  owner: string | null;
  /** Repository name */
  name: string | null;
  /** Star count */
  stars: number | null;
  /** Fork count */
  forks: number | null;
  /** Primary programming language */
  language: string | null;
  /** Repository topics/tags */
  topics: string[];
  /** License type (e.g., "MIT", "Apache-2.0") */
  license: string | null;
  /** Latest release tag name or null if no releases */
  lastRelease: string | null;
  /** Latest commit date (ISO string) */
  lastCommit: string | null;
  /** How the repo was found */
  method: 'url-extraction' | 'website-check' | 'jsonld-check' | 'readme-check' | 'github-search' | 'none';
  /** Confidence score 0-1 */
  confidence: number;
  /** Error message if resolution failed */
  error?: string;
}
