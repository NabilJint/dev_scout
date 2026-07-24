// app/api/cron/pipeline/route.ts
// GET /api/cron/pipeline — Vercel Cron handler for automatic hourly pipeline.
// Protected by CRON_SECRET (injected by Vercel automatically on cron requests).
// In local development, skip the secret check.
//
// Flow:
// 1. Sync schedules + Process scheduled results (Oxylabs scheduler path)
// 2. If step 1 fails, fall back to direct scraping via runScrapePipeline
// 3. Run AI analysis on newly inserted tools (always runs regardless)

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { syncSchedules, processScheduledResults } from '@/lib/scrape/scheduler';
import { runAnalysisPipeline } from '@/lib/analyze';
import { runScrapePipeline } from '@/lib/scrape/pipeline';
import { getActiveSources } from '@/lib/supabase/queries/sources';

function verifyCronSecret(request: NextRequest): { valid: boolean; error?: string } {
  const expected = process.env.CRON_SECRET;

  // In local development, skip the check
  if (!expected) {
    console.log('[Cron] CRON_SECRET not set — skipping auth check (local development)');
    return { valid: true };
  }

  const secret = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace('Bearer ', '') || '';

  if (secret !== expected) {
    return { valid: false, error: 'Invalid cron secret' };
  }

  return { valid: true };
}

export async function GET(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const pipelineRunId = crypto.randomUUID();
  console.log(`\n⏰ [Cron] Starting automatic pipeline (run: ${pipelineRunId})...`);
  const startTime = performance.now();

  const results: {
    sync: { status: string; error?: string } | null;
    scrape: { status: string; toolsInserted?: number; error?: string } | null;
    analysis: { status: string; analyzed?: number; error?: string } | null;
  } = {
    sync: null,
    scrape: null,
    analysis: null,
  };

  // Steps 1+2: Try Oxylabs scheduler path, fall back to direct scraping on failure
  try {
    console.log('\n🔄 [Cron] Step 1/3: Syncing schedules...');
    const syncSummary = await syncSchedules();
    results.sync = { status: syncSummary.status };
    console.log(`  ✅ [Cron] Sync completed: ${syncSummary.schedulesCreated} created, ${syncSummary.orphansDeactivated} orphans deactivated`);

    console.log('\n🔄 [Cron] Step 2/3: Processing scheduled results...');
    const processSummary = await processScheduledResults();
    results.scrape = {
      status: processSummary.status,
      toolsInserted: processSummary.pipelineSummary?.toolsInserted ?? 0,
    };
    console.log(`  ✅ [Cron] Process completed: ${results.scrape.toolsInserted} tools inserted`);

    // If either scheduler step returned failure status, trigger fallback
    if (syncSummary.status === 'failed' || processSummary.status === 'failed') {
      throw new Error('Oxylabs scheduler steps returned failure status');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`\n⚠️  [Cron] Oxylabs unavailable, falling back to direct scraping...`);
    console.log(`  ℹ️  [Cron] Reason: ${msg}`);

    // Fall back to direct scraping via runScrapePipeline
    try {
      const sources = await getActiveSources();
      const scrapeSummary = await runScrapePipeline(sources, {
        perSourceLimit: 5,
      });
      results.scrape = {
        status: scrapeSummary.status,
        toolsInserted: scrapeSummary.toolsInserted ?? 0,
      };
      results.sync = { status: 'fallback' };
      console.log(`  ✅ [Cron] Direct scrape completed: ${results.scrape.toolsInserted} tools inserted`);
    } catch (fallbackErr) {
      const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      console.error(`  ❌ [Cron] Direct scrape fallback also failed: ${fbMsg}`);
      results.scrape = { status: 'fallback_failed', error: fbMsg };
    }
  }

  // Step 3: Run AI analysis (runs even if step 2 failed)
  try {
    console.log('\n🔄 [Cron] Step 3/3: Running AI analysis...');
    const analysisSummary = await runAnalysisPipeline({ trigger: 'cron' });
    results.analysis = {
      status: analysisSummary.status,
      analyzed: analysisSummary.analyzed,
    };
    console.log(`  ✅ [Cron] Analysis completed: ${analysisSummary.analyzed} analyzed, ${analysisSummary.failed} failed`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ [Cron] Analysis failed: ${msg}`);
    results.analysis = { status: 'failed', error: msg };
  }

  const totalDuration = Math.round(performance.now() - startTime);
  console.log(`\n⏰ [Cron] Pipeline completed in ${totalDuration}ms`);

  return NextResponse.json({
    success: true,
    results,
    totalDurationMs: totalDuration,
  });
}