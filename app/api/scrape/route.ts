// app/api/scrape/route.ts
// POST /api/scrape — Manual scraping trigger.
// Requires x-devscout-admin-secret header (admin secret).
// Optionally accepts { sourceIds?: string[], sourceNames?: string[], perSourceLimit?: number }.
// Returns a PipelineSummary with counts and status.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getActiveSources, getSourceById } from '@/lib/supabase/queries/sources';
import { runScrapePipeline } from '@/lib/scrape/pipeline';
import { verifyAdminSecret } from '@/lib/scrape/middleware';
import { processScheduledResults } from '@/lib/scrape/scheduler';

const ScrapeRequestBody = z.object({
  sourceIds: z.array(z.string().uuid()).optional(),
  sourceNames: z.array(z.string()).optional(),
  perSourceLimit: z.number().int().min(1).max(50).optional(),
});

export async function POST(request: NextRequest) {
  // 1. Verify admin secret
  const auth = verifyAdminSecret(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  // 2. Parse and validate body
  const body = await request.json().catch(() => ({}));
  const parsed = ScrapeRequestBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
  const { sourceIds, sourceNames, perSourceLimit } = parsed.data;

  // 3. Select sources
  let sources;
  if (sourceIds && sourceIds.length > 0) {
    const results = await Promise.all(sourceIds.map(id => getSourceById(id)));
    sources = results.filter(Boolean);
    // TypeScript narrowing
    sources = sources.filter((s): s is NonNullable<typeof s> => s !== null);
  } else {
    sources = await getActiveSources();
  }

  // sourceNames override — filter by name (case-insensitive) when provided
  if (sourceNames && sourceNames.length > 0) {
    const allSources = await getActiveSources();
    const nameMap = new Map(allSources.map(s => [s.name.toLowerCase(), s]));
    sources = sourceNames
      .map(name => nameMap.get(name.toLowerCase()))
      .filter(Boolean) as typeof sources;
  }

  if (sources.length === 0) {
    return NextResponse.json({
      success: true,
      summary: {
        status: 'completed' as const,
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
      },
    });
  }

  // 4. Run pipeline — try Oxylabs scheduler fast path first
  try {
    // Fast path: check if Oxylabs already scraped results
    console.log('[Scrape] Trying Oxylabs scheduler fast path...');
    const schedulerSummary = await processScheduledResults();

    // If Oxylabs had results and inserted tools, return immediately
    if (schedulerSummary.status !== 'failed' && schedulerSummary.pipelineSummary) {
      console.log(`[Scrape] Fast path: ${schedulerSummary.pipelineSummary.toolsInserted} tools from Oxylabs`);
      return NextResponse.json({
        success: true,
        summary: schedulerSummary.pipelineSummary,
        source: 'oxylabs-scheduler',
      });
    }

    // Fallback: Oxylabs had no results, scrape live
    console.log('[Scrape] No Oxylabs results, falling back to live scraping...');
    const summary = await runScrapePipeline(sources, { perSourceLimit });
    return NextResponse.json({ success: true, summary, source: 'live-scrape' });
  } catch (err) {
    console.error('[Scrape] Live scrape fallback due to error:', err);
    // Final fallback: live scraping
    try {
      const summary = await runScrapePipeline(sources, { perSourceLimit });
      return NextResponse.json({ success: true, summary, source: 'live-scrape' });
    } catch (fallbackErr) {
      console.error('[Scrape] Live scrape also failed:', fallbackErr);
      return NextResponse.json(
        { success: false, error: fallbackErr instanceof Error ? fallbackErr.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }
}
