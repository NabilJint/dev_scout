import 'server-only';

// lib/scrape/pipeline.ts
// Scrape-to-insert pipeline orchestrator per AGENTS.md Section 9.
// Runs the full flow: load sources, scrape homepage, extract candidates,
// filter, dedupe, scrape detail pages, validate, insert.
//
// Refactored to extract processHomepageContent() as a shared function
// used by both runScrapePipeline() (manual) and scheduler processing.

import type { ToolSource, InsertToolParams, Json } from '@/lib/supabase/types';
import { getParser } from './parsers';
import { scrapeUrl } from './oxylabs';
import { cleanRawText, validateToolContent } from './validate';
import type { CandidateLink, PipelineSummary, ScrapedTool } from './types';
import { checkToolsExistByOriginalUrls, insertTool } from '@/lib/supabase/queries/tools';
import { logInfo, logError } from '@/lib/supabase/queries/logs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Source names that require JavaScript rendering via Oxylabs `render: "html"`.
 *
 * GitHub Trending and SaaSHub are React SPAs — without render Oxylabs returns
 * the empty client-side shell HTML, which contains zero candidate links.
 * BetaList also renders content via JS.
 */
const NEEDS_RENDER = new Set([
  'producthunt',
  'reddit',
  'github-trending',
  'saashub',
  'betalist',
]);

/** Default number of valid tools to attempt per source. */
const DEFAULT_PER_SOURCE_LIMIT = 5;

/** Patterns that match pages on the non-tool-page reject list (AGENTS.md §9). */
const NON_TOOL_PATTERNS = [
  /\/blog/i,
  /\/changelog/i,
  /\/category\//i,
  /\/categories\//i,
  /\/author\//i,
  /\/team\//i,
  /\/search/i,
  /\/status\b/i,
  /\/uptime/i,
  /\/careers/i,
  /\/jobs\b/i,
  /\/community/i,
  /\/forum/i,
  /\/comparison/i,
  /\/vs\//i,
  /\/alternatives\b/i,
  /\/press\b/i,
  /\/media-kit/i,
  /\/newsletter/i,
  /\/subscribe/i,
  /\/login/i,
  /\/signup/i,
  /\/register/i,
  /\/dashboard/i,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a URL for deduplication:
 * - Strip trailing slash
 * - Ensure https:// prefix
 * - Lowercase hostname
 */
function normalizeUrl(raw: string): string {
  try {
    const url = raw.trim();
    const hasProtocol = url.startsWith('http://') || url.startsWith('https://');
    const withProtocol = hasProtocol ? url : `https://${url}`;
    const parsed = new URL(withProtocol);
    parsed.protocol = 'https:';
    parsed.hash = '';

    // Remove trailing slash (but keep root /)
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return raw.trim();
  }
}

/**
 * Check a URL against the non-tool-page reject list patterns.
 * Returns the matched pattern reason, or undefined if it passes.
 */
function rejectNonToolUrl(url: string): string | undefined {
  for (const pattern of NON_TOOL_PATTERNS) {
    if (pattern.test(url)) {
      return `non_tool_page`;
    }
  }
  return undefined;
}

/**
 * Determine if a source needs JS rendering.
 */
function sourceNeedsRender(strategy: string): boolean {
  return NEEDS_RENDER.has(strategy);
}

/**
 * Format duration in a human-readable string from two hr time values.
 */
function formatDuration(startMs: number, endMs: number): string {
  const diffMs = endMs - startMs;
  if (diffMs < 1000) return `${Math.round(diffMs)}ms`;
  return `${(diffMs / 1000).toFixed(1)}s`;
}

function emptySummary(): PipelineSummary {
  return {
    status: 'completed',
    sourcesChecked: 0,
    sourcesErrored: 0,
    candidatesFound: 0,
    candidatesRejected: 0,
    duplicatesSkipped: 0,
    detailPagesScraped: 0,
    toolsInserted: 0,
    toolsRejected: 0,
    toolsFailed: 0,
    totalDuration: '0ms',
    rejectionReasons: {},
  };
}

// ---------------------------------------------------------------------------
// Pipeline orchestrator — manual scraping
// ---------------------------------------------------------------------------

/**
 * Run the scrape-to-insert pipeline for the given sources.
 * Fetches homepage HTML via Oxylabs Realtime, then delegates to processHomepageContent.
 *
 * @param sources  Active tool sources to scrape.
 * @param options  Optional `perSourceLimit` (default 5).
 * @returns        PipelineSummary with status and counts.
 */
export async function runScrapePipeline(
  sources: ToolSource[],
  options?: { perSourceLimit?: number }
): Promise<PipelineSummary> {
  const limit = options?.perSourceLimit ?? DEFAULT_PER_SOURCE_LIMIT;
  const startTime = performance.now();

  if (sources.length === 0) {
    return emptySummary();
  }

  // Fetch homepage HTML for each source
  const sourcesWithHtml: Array<{ source: ToolSource; html: string }> = [];
  let sourcesErrored = 0;

  for (const source of sources) {
    const strategy = source.parser_strategy;

    if (!strategy) {
      console.warn(`  ⚠️  [Scrape] Source "${source.name}" has no parser_strategy — skipping`);
      continue;
    }

    const parser = getParser(strategy);
    if (!parser) {
      console.warn(`  ⚠️  [Scrape] No parser found for strategy "${strategy}" (source: "${source.name}") — skipping`);
      continue;
    }

    console.log(`\n📡 [Scrape] Starting scrape for ${source.name}...`);

    const render = sourceNeedsRender(strategy);
    const homepageResult = await scrapeUrl(source.listing_url, { render });

    if (homepageResult.error) {
      sourcesErrored++;
      console.error(`  ❌ [Scrape] Error fetching homepage for ${source.name}: ${homepageResult.error}`);
      await logError(`Scrape error for ${source.name}`, {
        source: source.name,
        listingUrl: source.listing_url,
        error: homepageResult.error,
      });
      continue;
    }

    console.log(`  📄 [Scrape] Homepage fetched for ${source.name} (${source.listing_url})`);

    if (!homepageResult.content) {
      console.warn(`  ⚠️  [Scrape] Empty homepage content for ${source.name}`);
      continue;
    }

    sourcesWithHtml.push({ source, html: homepageResult.content });
  }

  // Delegate to shared processing function
  const summary = await processHomepageContent(sourcesWithHtml, { perSourceLimit: limit });

  // Adjust status based on source fetch errors
  if (sourcesErrored > 0 && summary.sourcesChecked === 0) {
    summary.status = 'failed';
  } else if (sourcesErrored > 0) {
    summary.status = 'partial';
  }

  // Add sourcesErrored to the summary
  summary.sourcesErrored = sourcesErrored;

  const endTime = performance.now();
  summary.totalDuration = formatDuration(startTime, endTime);

  console.log(`\n📊 [Scrape] Pipeline summary: ${JSON.stringify(summary, null, 2)}`);

  // Log to Supabase
  try {
    await logInfo('Scrape pipeline completed', {
      summary: summary as unknown as Json,
      sourceCount: sources.length,
      sourceNames: sources.map(s => s.name),
    } as Record<string, Json>);
  } catch {
    // non-critical — don't fail the pipeline if logging fails
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Shared processing function — used by both manual scraping and scheduler
// ---------------------------------------------------------------------------

/**
 * Process pre-fetched homepage HTML through the scrape-to-insert pipeline.
 * Shared between manual scraping and scheduler processing.
 *
 * Steps per AGENTS.md Section 9:
 * 4. Extract candidates from homepage HTML
 * 5. Reject non-tool URLs
 * 6. Normalize and dedupe URLs
 * 7. Check existing in Supabase
 * 8. Scrape tool detail pages
 * 9. Validate and clean
 * 10. Insert valid tools
 * 11. Log progress
 * 12. Return summary
 *
 * @param sourcesWithHtml - Array of sources paired with their homepage HTML content
 * @param options - Optional perSourceLimit (default 5)
 * @returns PipelineSummary with status and counts
 */
export async function processHomepageContent(
  sourcesWithHtml: Array<{ source: ToolSource; html: string }>,
  options?: { perSourceLimit?: number }
): Promise<PipelineSummary> {
  const limit = options?.perSourceLimit ?? DEFAULT_PER_SOURCE_LIMIT;

  // Accumulators
  let candidatesFound = 0;
  let candidatesRejected = 0;
  let duplicatesSkipped = 0;
  let detailPagesScraped = 0;
  let toolsInserted = 0;
  let toolsRejected = 0;
  let toolsFailed = 0;
  const rejectionReasons: Record<string, number> = {};
  let sourcesChecked = 0;

  if (sourcesWithHtml.length === 0) {
    return emptySummary();
  }

  for (const { source, html } of sourcesWithHtml) {
    const strategy = source.parser_strategy;

    // ---- Step 1: Determine parser ----
    if (!strategy) {
      console.warn(`  ⚠️  [Pipeline] Source "${source.name}" has no parser_strategy — skipping`);
      continue;
    }

    const parser = getParser(strategy);
    if (!parser) {
      console.warn(`  ⚠️  [Pipeline] No parser found for strategy "${strategy}" (source: "${source.name}") — skipping`);
      continue;
    }

    sourcesChecked++;
    console.log(`\n📡 [Pipeline] Processing ${source.name}...`);

    // ---- Step 4: Extract candidates ----
    let candidates: CandidateLink[];
    try {
      candidates = parser.extractCandidates(html);
    } catch (err) {
      console.error(`  ❌ [Pipeline] Parser error extracting candidates from ${source.name}: ${err}`);
      await logError(`Parser error for ${source.name}`, {
        source: source.name,
        error: String(err),
      });
      continue;
    }

    console.log(`  🔗 [Pipeline] Found ${candidates.length} candidate links on ${source.name}`);
    candidatesFound += candidates.length;

    if (candidates.length === 0) {
      console.log(`  ⚠️  [Pipeline] No candidates found on ${source.name} — skipping`);
      continue;
    }

    // ---- Step 5: Reject non-tool URLs ----
    const filteredCandidates: CandidateLink[] = [];
    let sourceRejected = 0;

    for (const candidate of candidates) {
      const normalizedUrl = normalizeUrl(candidate.url);

      if (!parser.isToolUrl(normalizedUrl)) {
        sourceRejected++;
        continue;
      }

      const rejectReason = rejectNonToolUrl(normalizedUrl);
      if (rejectReason) {
        sourceRejected++;
        continue;
      }

      filteredCandidates.push({ ...candidate, url: normalizedUrl });
    }

    candidatesRejected += sourceRejected;
    if (sourceRejected > 0) {
      const reason = 'non_tool_page';
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + sourceRejected;
      console.log(`  ❌ [Pipeline] Rejected ${sourceRejected} candidates on ${source.name} (not a tool URL)`);
    }

    // ---- Step 6: Dedupe within source ----
    const seenInSource = new Set<string>();
    const dedupedCandidates: CandidateLink[] = [];

    for (const candidate of filteredCandidates) {
      const key = candidate.url.toLowerCase();
      if (seenInSource.has(key)) {
        duplicatesSkipped++;
        continue;
      }
      seenInSource.add(key);
      dedupedCandidates.push(candidate);
    }

    const sourceDupes = filteredCandidates.length - dedupedCandidates.length;
    if (sourceDupes > 0) {
      console.log(`  🔁 [Pipeline] Skipped ${sourceDupes} duplicates on ${source.name} (within source)`);
    }

    // ---- Step 7: Check existing in Supabase ----
    const candidateUrls = dedupedCandidates.map(c => c.url);
    const existingUrls = await checkToolsExistByOriginalUrls(candidateUrls);
    const newCandidates = dedupedCandidates.filter(c => !existingUrls.has(c.url));

    const dbDupes = dedupedCandidates.length - newCandidates.length;
    duplicatesSkipped += dbDupes;
    if (dbDupes > 0) {
      console.log(`  🔁 [Pipeline] Skipped ${dbDupes} duplicates on ${source.name} (already in DB)`);
    }

    // Apply per-source limit
    let candidatesToProcess = newCandidates;
    if (limit > 0 && candidatesToProcess.length > limit) {
      console.log(`  📐 [Pipeline] Limiting ${source.name} from ${candidatesToProcess.length} to ${limit}`);
      candidatesToProcess = candidatesToProcess.slice(0, limit);
    }

    if (candidatesToProcess.length === 0) {
      console.log(`  ⚠️  [Pipeline] No new candidates to process on ${source.name}`);
      continue;
    }

    // ---- Step 8: Scrape tool detail pages ----
    console.log(`  📄 [Pipeline] Fetching ${candidatesToProcess.length} detail pages from ${source.name}...`);

    for (const candidate of candidatesToProcess) {
      // Always use render for detail pages to get complete content
      const detailResult = await scrapeUrl(candidate.url, { render: true });

      if (detailResult.error) {
        console.error(`    ❌ [Pipeline] Failed to fetch detail: ${candidate.url} — ${detailResult.error}`);
        toolsFailed++;
        continue;
      }

      detailPagesScraped++;

      // ---- Extract tool content ----
      let scrapedTool: ScrapedTool | null = null;
      try {
        scrapedTool = parser.extractToolContent(detailResult.content);
      } catch (err) {
        console.error(`    ❌ [Pipeline] Parser error extracting tool content from ${candidate.url}: ${err}`);
        toolsFailed++;
        continue;
      }

      if (!scrapedTool) {
        console.error(`    ❌ [Pipeline] Failed to parse tool content from ${candidate.url}`);
        toolsFailed++;
        continue;
      }

      // ---- Set websiteUrl from candidate ----
      if (!scrapedTool.websiteUrl) {
        if (candidate.websiteUrl) {
          scrapedTool.websiteUrl = candidate.websiteUrl;
        } else if (source.name === 'GitHub Trending') {
          scrapedTool.websiteUrl = candidate.url;
        } else {
          try {
            const parsedCandidate = new URL(candidate.url);
            const sourceDomain = new URL(source.listing_url).hostname;
            if (parsedCandidate.hostname !== sourceDomain) {
              scrapedTool.websiteUrl = candidate.url;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      // ---- Enrichment step ----
      const { enrichTool } = await import('@/lib/enrichment');
      let contentSource: 'detail' | 'enrichment' = 'detail';
      if (scrapedTool.websiteUrl) {
        console.log(`    🔍 [Pipeline] Enriching from tool website: ${scrapedTool.websiteUrl}`);
        const enrichment = await enrichTool({
          name: scrapedTool.title,
          websiteUrl: scrapedTool.websiteUrl,
        });

        if (enrichment.content) {
          if (enrichment.content.rawText.length > 200) {
            scrapedTool.rawText = enrichment.content.rawText;
            contentSource = 'enrichment';
            console.log(`    ✅ [Pipeline] Enriched raw text (${enrichment.content.rawText.length} chars) from ${scrapedTool.websiteUrl} (source: ${enrichment.content.source})`);
          }

          if (!scrapedTool.imageUrl && enrichment.content.ogImage) {
            scrapedTool.imageUrl = enrichment.content.ogImage;
          }
        }

        if (enrichment.logo?.url && enrichment.logo.source !== 'none') {
          scrapedTool.imageUrl = enrichment.logo.url;
        }
      }

      // ---- Clean raw text ----
      if (contentSource === 'detail') {
        const cleanedRawText = cleanRawText(detailResult.content);
        scrapedTool.rawText = cleanedRawText;
      }

      // ---- Validate ----
      const validation = validateToolContent(scrapedTool);
      if (!validation.valid) {
        const reason = validation.reason || 'unknown';
        rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
        toolsRejected++;
        console.log(`    ❌ [Pipeline] Rejected "${scrapedTool.title}" from ${source.name} (${reason})`);
        continue;
      }

      // ---- Insert ----
      try {
        const insertParams: InsertToolParams = {
          source_id: source.id,
          original_url: candidate.url,
          canonical_url: candidate.url,
          name: scrapedTool.title,
          brand_text: null,
          image_url: scrapedTool.imageUrl,
          website_url: scrapedTool.websiteUrl || null,
          curation_status: 'auto-suggested',
          last_updated: scrapedTool.lastUpdated,
          raw_text: scrapedTool.rawText,
        };

        const inserted = await insertTool(insertParams);
        toolsInserted++;
        console.log(`    ✅ [Pipeline] Inserted "${inserted.name}" from ${source.name}`);
      } catch (err) {
        console.error(`    ❌ [Pipeline] DB insert failed for "${scrapedTool.title}" from ${source.name}: ${err}`);
        toolsFailed++;
      }
    }

    console.log(`  📊 [Pipeline] Source "${source.name}" done: ${toolsInserted} inserted, ${toolsRejected} rejected, ${toolsFailed} failed`);
  }

  // Determine status
  let status: PipelineSummary['status'] = 'completed';
  if (sourcesChecked > 0 && toolsInserted === 0 && candidatesFound === 0) {
    status = 'completed'; // All sources returned content but found no candidates
  }

  return {
    status,
    sourcesChecked,
    sourcesErrored: 0, // processHomepageContent doesn't track source fetch errors
    candidatesFound,
    candidatesRejected,
    duplicatesSkipped,
    detailPagesScraped,
    toolsInserted,
    toolsRejected,
    toolsFailed,
    totalDuration: '0ms', // Caller sets this
    rejectionReasons,
  };
}