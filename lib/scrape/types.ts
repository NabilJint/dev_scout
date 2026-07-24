// lib/scrape/types.ts
// Shared types for the scraping pipeline

/**
 * Canonical stage names for the scrape/analyze pipeline.
 * Each stage maps to a well-defined phase of processing.
 */
export type PipelineStage =
  | 'RESOLVE_URL'       // Resolving a tool's canonical website URL
  | 'FETCH'             // Fetching HTML (Oxylabs, direct HTTP, or Jina)
  | 'EXTRACT'           // Parsing HTML and extracting structured data
  | 'NORMALIZE'         // Cleaning, normalizing, deduplicating
  | 'STORE'             // Inserting or updating database records
  | 'AI_ANALYSIS'       // AI analysis call (tool rating, adoption, etc.)
  | 'SAVE'              // Saving analysis results to database
  ;

/**
 * Metadata for a single stage execution.
 */
export interface StageLogEntry {
  stage: PipelineStage;
  startTime: number;      // performance.now() at start
  endTime?: number;       // performance.now() at end
  durationMs?: number;    // endTime - startTime
  status: 'started' | 'completed' | 'failed';
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface CandidateLink {
  url: string;
  title: string;
  description?: string;
  /** Actual tool website URL, if extractable from the listing page.
   *  For Hacker News: this IS the candidate.url (external link).
   *  For Product Hunt: this is unknown until detail page is fetched. */
  websiteUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ScrapedTool {
  title: string;
  description: string;
  imageUrl: string;
  lastUpdated: string;   // ISO date string
  rawText: string;
  /** The tool's actual website URL (e.g., "https://cursor.com"),
   *  distinct from the source detail page URL. */
  websiteUrl?: string | null;
}

export interface PipelineSummary {
  status: 'completed' | 'failed' | 'partial';
  sourcesChecked: number;
  sourcesErrored: number;  // sources that failed during homepage fetch
  candidatesFound: number;
  candidatesRejected: number;
  duplicatesSkipped: number;
  contentDuplicatesSkipped?: number;  // optional — content-hash-level dedup count
  detailPagesScraped: number;
  toolsInserted: number;
  toolsRejected: number;
  toolsFailed: number;
  totalDuration: string;   // human-readable like "3.2s" or "45.1s"
  rejectionReasons: Record<string, number>;  // reason -> count
  /** Optional array of structured stage log entries for this pipeline run. */
  stages?: StageLogEntry[];
}

/**
 * Detailed breakdown of a content quality score.
 */
export interface ContentScore {
  /** Total weighted score. >= threshold means content is acceptable. */
  total: number;
  /** Contribution from content length (chars / 10, capped at 100). */
  contentLength: number;
  /** 20 points if a title element is detected. */
  titlePresent: number;
  /** 30 points if extracted from <main> or <article> element. */
  mainElement: number;
  /** Points from markdown structure density (code, headers, lists), up to 50. */
  markdownDensity: number;
  /** Penalty for SPA shell / boilerplate content (-200 max). */
  spaShellPenalty: number;
  /** Penalty for captcha / blocked page content (-300 max). */
  captchaPenalty: number;
  /** Whether the score passes the threshold. */
  acceptable: boolean;
}

/**
 * Options for scoring.
 */
export interface ScoreOptions {
  /** Whether the content was extracted from a <main> or <article> element. */
  fromMainElement?: boolean;
  /** Custom threshold override. Defaults to 150. */
  threshold?: number;
}

export interface Parser {
  /** Display name of this parser/source */
  name: string;
  /** Check if a URL looks like a real tool listing page for this source */
  isToolUrl(url: string): boolean;
  /** Extract candidate links from the homepage listing HTML */
  extractCandidates(html: string): CandidateLink[];
  /** Extract tool details from a tool detail page HTML */
  extractToolContent(html: string): ScrapedTool | null;
}

// ============================================================================
// Provider priority types (for tool_sources.provider_priority JSONB column)
// ============================================================================

/**
 * Known content-fetch provider names.
 */
export type ProviderName = 'http' | 'oxylabs' | 'jina';

/**
 * Simple provider reference: just the name.
 */
export interface ProviderConfig {
  provider: ProviderName;
  /** Provider-specific options (optional, per-provider semantics). */
  timeout?: number;
  render?: boolean;
  [key: string]: unknown;
}

/**
 * Provider priority can be specified as:
 * - An array of provider name strings: ["http", "oxylabs"]
 * - An array of provider config objects: [{provider: "http", timeout: 5000}, {provider: "oxylabs"}]
 * - null (default: ["http"])
 */
export type ProviderPriority = ProviderName[] | ProviderConfig[] | null;
