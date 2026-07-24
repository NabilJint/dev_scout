// app/api/cron/pipeline/route.ts
// GET /api/cron/pipeline — Vercel Cron handler for automatic hourly pipeline.
// Protected by CRON_SECRET (injected by Vercel automatically on cron requests).
// In local development, skip the secret check.
//
// Flow:
// 1. Sync schedules (ensure schedules exist for active sources)
// 2. Process scheduled results (fetch completed Oxylabs job HTML, run pipeline)
// 3. Run AI analysis on newly inserted tools
// 4. If step 2 fails, step 3 still runs (there may be pre-existing unanalyzed tools)

import { NextRequest, NextResponse } from 'next/server';
import { syncSchedules, processScheduledResults } from '@/lib/scrape/scheduler';
import { runAnalysisPipeline } from '@/lib/analyze';
import { getPostHogClient } from '@/lib/posthog-server';

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

  console.log('\n⏰ [Cron] Starting automatic pipeline...');
  const startTime = performance.now();

  const posthog = getPostHogClient();
  const results: {
    sync: { status: string; error?: string } | null;
    scrape: { status: string; toolsInserted?: number; error?: string } | null;
    analysis: { status: string; analyzed?: number; error?: string } | null;
  } = {
    sync: null,
    scrape: null,
    analysis: null,
  };

  // Step 1: Sync schedules
  try {
    console.log('\n🔄 [Cron] Step 1/3: Syncing schedules...');
    const syncSummary = await syncSchedules();
    results.sync = { status: syncSummary.status };
    console.log(`  ✅ [Cron] Sync completed: ${syncSummary.schedulesCreated} created, ${syncSummary.orphansDeactivated} orphans deactivated`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ [Cron] Sync failed: ${msg}`);
    results.sync = { status: 'failed', error: msg };
  }

  // Step 2: Process scheduled results
  try {
    console.log('\n🔄 [Cron] Step 2/3: Processing scheduled results...');
    const processSummary = await processScheduledResults();
    results.scrape = {
      status: processSummary.status,
      toolsInserted: processSummary.pipelineSummary?.toolsInserted ?? 0,
    };
    console.log(`  ✅ [Cron] Process completed: ${results.scrape.toolsInserted} tools inserted`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ [Cron] Process failed: ${msg}`);
    results.scrape = { status: 'failed', error: msg };
  }

  // Step 3: Run AI analysis (runs even if step 2 failed)
  try {
    console.log('\n🔄 [Cron] Step 3/3: Running AI analysis...');
    const analysisSummary = await runAnalysisPipeline();
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

  posthog.capture({
    distinctId: 'server',
    event: 'cron_pipeline_completed',
    properties: {
      sync_status: results.sync?.status,
      scrape_status: results.scrape?.status,
      analysis_status: results.analysis?.status,
      tools_inserted: results.scrape?.toolsInserted ?? 0,
      tools_analyzed: results.analysis?.analyzed ?? 0,
      total_duration_ms: totalDuration,
    },
  });
  await posthog.flush();

  return NextResponse.json({
    success: true,
    results,
    totalDurationMs: totalDuration,
  });
}