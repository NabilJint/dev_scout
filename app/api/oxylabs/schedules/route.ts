// app/api/oxylabs/schedules/route.ts
// POST /api/oxylabs/schedules — Sync schedules with Oxylabs
// GET /api/oxylabs/schedules — List stored schedules

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSecret } from '@/lib/scrape/middleware';
import { syncSchedules } from '@/lib/scrape/scheduler';
import { getSchedules } from '@/lib/supabase/queries/schedules';
import { getPostHogClient } from '@/lib/posthog-server';

/**
 * POST /api/oxylabs/schedules
 * Sync schedules: creates one Oxylabs schedule per active source,
 * deactivates orphan schedules on Oxylabs.
 * Requires x-devscout-admin-secret header.
 */
export async function POST(request: NextRequest) {
  const auth = verifyAdminSecret(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const posthog = getPostHogClient();
  try {
    const summary = await syncSchedules();
    posthog.capture({
      distinctId: 'server',
      event: 'scheduler_sync_completed',
      properties: {
        status: summary.status,
        schedules_created: summary.schedulesCreated,
        orphans_deactivated: summary.orphansDeactivated,
        errors: summary.errors.length,
      },
    });
    await posthog.flush();
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    console.error('[Schedules] Sync error:', err);
    posthog.capture({
      distinctId: 'server',
      event: 'scheduler_sync_completed',
      properties: { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' },
    });
    await posthog.flush();
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/oxylabs/schedules
 * List stored schedules from the database.
 * Requires x-devscout-admin-secret header.
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminSecret(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  try {
    const schedules = await getSchedules();
    return NextResponse.json({ success: true, schedules });
  } catch (err) {
    console.error('[Schedules] List error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}