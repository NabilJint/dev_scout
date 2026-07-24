import 'server-only';
import crypto from 'crypto';

// lib/scrape/scheduler.ts
// Scheduler processing orchestrator.
// Handles: syncing schedules with Oxylabs, processing completed job results.

import type { ToolSource, Json } from '@/lib/supabase/types';
import type { PipelineSummary } from './types';
import { getActiveSources, getSourceById } from '@/lib/supabase/queries/sources';
import {
  getSchedules,
  insertSchedule,
  getScheduleBySourceId,
} from '@/lib/supabase/queries/schedules';
import { logInfo, logStageStart, logStageEnd } from '@/lib/supabase/queries/logs';
import { processHomepageContent } from './pipeline';
import {
  createSchedule,
  listSchedules,
  getScheduleRuns,
  getJobResults,
  activateSchedule as reactivateOxylabsSchedule,
  deactivateSchedule as deactivateOxylabsSchedule,
} from './oxylabs-scheduler';

// ============================================================================
// Constants
// ============================================================================

/** Cron expression for hourly scraping at the top of the hour. */
const HOURLY_CRON = '0 * * * *';

/** End time: 1 year from now. */
function getEndTime(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  // Format as "YYYY-MM-DD HH:mm:ss" (Oxylabs format)
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

/** Source names that need JS rendering for the scheduler job. */
const NEEDS_RENDER = new Set([
  'producthunt',
  'reddit',
  'github-trending',
  'saashub',
  'betalist',
]);

// ============================================================================
// Sync Schedules
// ============================================================================

export interface SyncSchedulesSummary {
  status: 'completed' | 'partial' | 'failed';
  sourcesChecked: number;
  schedulesCreated: number;
  schedulesAlreadyExist: number;
  orphansDeactivated: number;
  errors: string[];
}

/**
 * Sync Oxylabs schedules with active sources in Supabase.
 * Creates one schedule per active source. Deactivates orphaned schedules.
 */
export async function syncSchedules(): Promise<SyncSchedulesSummary> {
  const pipelineRunId = crypto.randomUUID();
  console.log('\n🔄 [Scheduler] Syncing schedules with Oxylabs...');
  const syncStart = await logStageStart('NORMALIZE', { operation: 'sync-schedules' }, pipelineRunId);

  const errors: string[] = [];
  let schedulesCreated = 0;
  let schedulesAlreadyExist = 0;

  // 1. Load active sources
  const sources = await getActiveSources();
  console.log(`  📊 [Scheduler] Found ${sources.length} active sources`);

  if (sources.length === 0) {
    console.log('  ⚠️  [Scheduler] No active sources found');
    await logStageEnd(syncStart, { status: 'completed', metadata: { sourcesFound: 0 }, pipelineRunId });
    return {
      status: 'completed',
      sourcesChecked: 0,
      schedulesCreated: 0,
      schedulesAlreadyExist: 0,
      orphansDeactivated: 0,
      errors: [],
    };
  }

  // 2. Create/ensure schedules for each active source
  for (const source of sources) {
    try {
      const existing = await getScheduleBySourceId(source.id);

      if (existing && existing.active) {
        // Ensure the Oxylabs schedule is active too (idempotent if already active)
        try {
          await reactivateOxylabsSchedule(existing.oxylabs_schedule_id);
        } catch (err) {
          console.warn(`  ⚠️  [Scheduler] Could not reactivate Oxylabs schedule ${existing.oxylabs_schedule_id}: ${err}`);
        }
        console.log(`  ℹ️  [Scheduler] Schedule already exists for ${source.name} (DB id: ${existing.id})`);
        schedulesAlreadyExist++;
        continue;
      }

      // Create a new Oxylabs schedule
      const items = [{
        source: 'universal',
        url: source.listing_url,
        ...(NEEDS_RENDER.has(source.parser_strategy || '') ? { render: 'html' } : {}),
      }];

      const result = await createSchedule({
        cron: HOURLY_CRON,
        items,
        endTime: getEndTime(),
      });

      // Store in DB
      await insertSchedule({
        oxylabs_schedule_id: result.scheduleId,
        source_id: source.id,
        active: true,
      });

      schedulesCreated++;
      console.log(`  ✅ [Scheduler] Created schedule for ${source.name} (Oxylabs ID: ${result.scheduleId})`);
    } catch (err) {
      const msg = `Failed to create schedule for ${source.name}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`  ❌ [Scheduler] ${msg}`);
      errors.push(msg);
    }
  }

  // 3. Orphan schedule cleanup
  let orphansDeactivated = 0;
  try {
    orphansDeactivated = await cleanupOrphanSchedules();
  } catch (err) {
    const msg = `Orphan cleanup failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`  ❌ [Scheduler] ${msg}`);
    errors.push(msg);
  }

  const status: SyncSchedulesSummary['status'] =
    errors.length === 0 ? 'completed'
    : schedulesCreated > 0 ? 'partial'
    : 'failed';

  const summary: SyncSchedulesSummary = {
    status,
    sourcesChecked: sources.length,
    schedulesCreated,
    schedulesAlreadyExist,
    orphansDeactivated,
    errors,
  };

  console.log(`\n📊 [Scheduler] Sync summary: ${JSON.stringify(summary, null, 2)}`);

  try {
    await logInfo('Scheduler sync completed', { summary, pipelineRunId } as unknown as Json, pipelineRunId);
  } catch {
    // non-critical
  }

  await logStageEnd(syncStart, { status: status === 'failed' ? 'failed' : 'completed', metadata: { schedulesCreated, orphansDeactivated, errors: errors.length }, pipelineRunId });

  return summary;
}

/**
 * Clean up orphaned schedules on Oxylabs.
 * 1. List all Oxylabs schedule IDs
 * 2. Compare against DB records
 * 3. Deactivate any Oxylabs schedule not in DB
 */
async function cleanupOrphanSchedules(): Promise<number> {
  console.log('  🔍 [Scheduler] Checking for orphan schedules...');

  const oxylabsIds = await listSchedules();
  console.log(`  📊 [Scheduler] Found ${oxylabsIds.length} schedules on Oxylabs`);

  if (oxylabsIds.length === 0) return 0;

  // Get all active schedules from DB
  const dbSchedules = await getSchedules(true);
  const dbOxylabsIds = new Set(dbSchedules.map(s => s.oxylabs_schedule_id));

  // Find orphans: Oxylabs schedules not in DB
  const orphanIds = oxylabsIds.filter(id => !dbOxylabsIds.has(id));

  if (orphanIds.length === 0) {
    console.log('  ✅ [Scheduler] No orphan schedules found');
    return 0;
  }

  console.log(`  ⚠️  [Scheduler] Found ${orphanIds.length} orphan schedules, deactivating...`);

  for (const id of orphanIds) {
    try {
      await deactivateOxylabsSchedule(id);
      console.log(`    ✅ [Scheduler] Deactivated orphan schedule ${id}`);
    } catch (err) {
      console.error(`    ❌ [Scheduler] Failed to deactivate orphan schedule ${id}: ${err}`);
    }
  }

  return orphanIds.length;
}

// ============================================================================
// Process Scheduled Results
// ============================================================================

export interface ProcessResultsSummary {
  status: 'completed' | 'partial' | 'failed';
  schedulesProcessed: number;
  runsFound: number;
  doneJobsFound: number;
  jobsFetched: number;
  sourcesWithHtml: number;
  pipelineSummary: PipelineSummary | null;
  errors: string[];
}

/**
 * Process completed Oxylabs scheduler job results.
 * Fetches completed job HTML from Oxylabs, then runs the shared pipeline.
 */
export async function processScheduledResults(): Promise<ProcessResultsSummary> {
  const pipelineRunId = crypto.randomUUID();
  console.log('\n📡 [Scheduler] Processing scheduled results...');

  const errors: string[] = [];
  let schedulesProcessed = 0;
  let runsFound = 0;
  let doneJobsFound = 0;
  let jobsFetched = 0;

  // 1. Load active schedules from DB
  const dbSchedules = await getSchedules(true);
  console.log(`  📊 [Scheduler] Found ${dbSchedules.length} active schedules in DB`);

  if (dbSchedules.length === 0) {
    console.log('  ⚠️  [Scheduler] No active schedules found — run sync first');
    return {
      status: 'completed',
      schedulesProcessed: 0,
      runsFound: 0,
      doneJobsFound: 0,
      jobsFetched: 0,
      sourcesWithHtml: 0,
      pipelineSummary: null,
      errors: [],
    };
  }

  // 2. For each schedule, fetch runs and find done jobs
  const sourcesWithHtml: Array<{ source: ToolSource; html: string }> = [];

  for (const dbSchedule of dbSchedules) {
    try {
      console.log(`  📡 [Scheduler] Checking schedule ${dbSchedule.oxylabs_schedule_id}...`);

      const runs = await getScheduleRuns(dbSchedule.oxylabs_schedule_id);
      runsFound += runs.length;

      if (runs.length === 0) {
        console.log(`    ℹ️  [Scheduler] No runs found for schedule ${dbSchedule.oxylabs_schedule_id}`);
        continue;
      }

      // Get the most recent run
      const latestRun = runs[0];
      const doneJobs = latestRun.jobs.filter(j => j.resultStatus === 'done');
      doneJobsFound += doneJobs.length;

      if (doneJobs.length === 0) {
        console.log(`    ⏳ [Scheduler] No done jobs in latest run (run ${latestRun.runId})`);
        continue;
      }

      console.log(`    📊 [Scheduler] Run ${latestRun.runId}: ${doneJobs.length} done jobs`);

      // Fetch results for each done job
      for (const job of doneJobs) {
        const jobFetchStart = await logStageStart('FETCH', { scheduleId: dbSchedule.oxylabs_schedule_id, jobId: job.id, phase: 'scheduler-job-result' }, pipelineRunId);
        try {
          const result = await getJobResults(job.id);
          if (result && result.content) {
            await logStageEnd(jobFetchStart, { status: 'completed', metadata: { statusCode: result.statusCode }, pipelineRunId });
            jobsFetched++;
            console.log(`    ✅ [Scheduler] Fetched result for job ${job.id} (${result.statusCode})`);

            // Store HTML with source reference — resolve source below
            sourcesWithHtml.push({
              source: { id: dbSchedule.source_id } as ToolSource,
              html: result.content,
            });
          } else {
            await logStageEnd(jobFetchStart, { status: 'failed', error: 'Empty result', pipelineRunId });
            console.warn(`    ⚠️  [Scheduler] Empty result for job ${job.id}`);
          }
        } catch (err) {
          await logStageEnd(jobFetchStart, { status: 'failed', error: String(err), pipelineRunId });
          const msg = `Failed to fetch job ${job.id}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`    ❌ [Scheduler] ${msg}`);
          errors.push(msg);
        }
      }

      schedulesProcessed++;
    } catch (err) {
      const msg = `Failed to process schedule ${dbSchedule.oxylabs_schedule_id}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`  ❌ [Scheduler] ${msg}`);
      errors.push(msg);
    }
  }

  if (sourcesWithHtml.length === 0) {
    console.log('  ⚠️  [Scheduler] No completed job results to process');
    return {
      status: 'completed',
      schedulesProcessed,
      runsFound,
      doneJobsFound,
      jobsFetched,
      sourcesWithHtml: 0,
      pipelineSummary: null,
      errors,
    };
  }

  // 3. Resolve full source objects for each HTML result
  const resolvedSourcesWithHtml: Array<{ source: ToolSource; html: string }> = [];
  for (const item of sourcesWithHtml) {
    const source = await getSourceById(item.source.id);
    if (source) {
      resolvedSourcesWithHtml.push({ source, html: item.html });
    } else {
      console.warn(`  ⚠️  [Scheduler] Source ${item.source.id} not found in DB`);
    }
  }

  // 4. Run the shared pipeline on the fetched HTML
  console.log(`\n  🔄 [Scheduler] Running pipeline on ${resolvedSourcesWithHtml.length} source homepages...`);

  let pipelineSummary: PipelineSummary | null = null;
  try {
    pipelineSummary = await processHomepageContent(resolvedSourcesWithHtml, { pipelineRunId });
    console.log(`  ✅ [Scheduler] Pipeline completed: ${pipelineSummary.toolsInserted} tools inserted`);
  } catch (err) {
    const msg = `Pipeline error: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`  ❌ [Scheduler] ${msg}`);
    errors.push(msg);
  }

  const status: ProcessResultsSummary['status'] =
    errors.length === 0 ? 'completed'
    : pipelineSummary && pipelineSummary.toolsInserted > 0 ? 'partial'
    : 'failed';

  const summary: ProcessResultsSummary = {
    status,
    schedulesProcessed,
    runsFound,
    doneJobsFound,
    jobsFetched,
    sourcesWithHtml: resolvedSourcesWithHtml.length,
    pipelineSummary,
    errors,
  };

  console.log(`\n📊 [Scheduler] Process summary: ${JSON.stringify(summary, null, 2)}`);

  try {
    await logInfo('Scheduler process completed', { summary, pipelineRunId } as unknown as Json, pipelineRunId);
  } catch {
    // non-critical
  }

  return summary;
}