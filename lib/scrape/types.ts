// lib/scrape/types.ts
// Shared types for the scraping pipeline

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
  detailPagesScraped: number;
  toolsInserted: number;
  toolsRejected: number;
  toolsFailed: number;
  totalDuration: string;   // human-readable like "3.2s" or "45.1s"
  rejectionReasons: Record<string, number>;  // reason -> count
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
