// app/api/oxylabs/scheduled-results/process/route.ts
// POST /api/oxylabs/scheduled-results/process — Manually process scheduled results
// Requires x-devscout-admin-secret header.

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSecret } from '@/lib/scrape/middleware';
import { processScheduledResults } from '@/lib/scrape/scheduler';
import { getPostHogClient } from '@/lib/posthog-server';

export async function POST(request: NextRequest) {
  const auth = verifyAdminSecret(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const posthog = getPostHogClient();
  try {
    const summary = await processScheduledResults();
    posthog.capture({
      distinctId: 'server',
      event: 'scheduler_process_completed',
      properties: {
        status: summary.status,
        schedules_processed: summary.schedulesProcessed,
        done_jobs_found: summary.doneJobsFound,
        tools_inserted: summary.pipelineSummary?.toolsInserted ?? 0,
        errors: summary.errors.length,
      },
    });
    await posthog.flush();
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    console.error('[ScheduledResults] Process error:', err);
    posthog.capture({
      distinctId: 'server',
      event: 'scheduler_process_completed',
      properties: { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' },
    });
    await posthog.flush();
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}