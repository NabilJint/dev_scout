// lib/supabase/queries/logs.ts
// Query functions for logs table
// Service role only - no anon access per AGENTS.md Section 7. All reads use createServerClient().

import { createServerClient } from '../client';
import type { Log, InsertLogParams, GetLogsParams, Json } from '../types';
import type { PipelineStage, StageLogEntry } from '@/lib/scrape/types';

// ============================================================================
// READ QUERIES (service role only - no anon access)
// ============================================================================

export async function getLogs(params: GetLogsParams = {}): Promise<Log[]> {
  const { limit = 100, offset = 0, level, since } = params;
  const supabase = await createServerClient();

  let query = supabase
    .from('logs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (level) {
    query = query.eq('level', level);
  }

  if (since) {
    query = query.gte('created_at', since);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching logs:', error);
    throw new Error(`Failed to fetch logs: ${error.message}`);
  }

  return (data as unknown as Log[]) || [];
}

export async function getLogCount(level?: 'info' | 'warn' | 'error'): Promise<number> {
  const supabase = await createServerClient();

  let query = supabase.from('logs').select('*', { count: 'exact', head: true });

  if (level) {
    query = query.eq('level', level);
  }

  const { count, error } = await query;

  if (error) {
    console.error('Error counting logs:', error);
    throw new Error(`Failed to count logs: ${error.message}`);
  }

  return count || 0;
}

export async function getRecentErrors(limit = 50): Promise<Log[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .eq('level', 'error')
    .order('created_at', { ascending: false })
    .limit(limit)
    .overrideTypes<Log[], { merge: false }>();

  if (error) {
    console.error('Error fetching recent errors:', error);
    throw new Error(`Failed to fetch recent errors: ${error.message}`);
  }

  return (data as Log[]) || [];
}

// ============================================================================
// WRITE QUERIES (service role client)
// ============================================================================

export async function insertLog(params: InsertLogParams): Promise<Log> {
  const supabase = await createServerClient();

  const insertData: Record<string, unknown> = {
    level: params.level,
    message: params.message,
    metadata: params.metadata ?? null,
  };

  // Try with pipeline_run_id column first, fall back to without
  const errors: string[] = [];
  for (const useRunId of [true, false]) {
    try {
      if (useRunId && params.pipeline_run_id) {
        insertData.pipeline_run_id = params.pipeline_run_id;
      } else {
        delete insertData.pipeline_run_id;
      }

      const { data, error } = await supabase
        .from('logs')
        .insert(insertData)
        .select()
        .single()
        .overrideTypes<Log, { merge: false }>();

      if (error) throw error;
      return data as Log;
    } catch (err: unknown) {
      const msg = (err && typeof err === 'object') ? JSON.stringify(err) : String(err);
      errors.push(msg);
      if (!msg.includes('pipeline_run_id')) {
        // Not a schema issue — fail fast
        console.error('Error inserting log:', err);
        throw new Error(`Failed to insert log: ${msg}`);
      }
      // Fall through to retry without pipeline_run_id
    }
  }

  // Both attempts failed
  console.error('Error inserting log (both attempts):', errors.join(' | '));
  throw new Error(`Failed to insert log: ${errors[errors.length - 1]}`);
}

export async function insertLogs(logs: InsertLogParams[]): Promise<Log[]> {
  if (logs.length === 0) return [];

  const supabase = await createServerClient();

  const insertData = logs.map(l => {
    const row: Record<string, unknown> = {
      level: l.level,
      message: l.message,
      metadata: l.metadata ?? null,
    };
    try {
      row.pipeline_run_id = l.pipeline_run_id ?? null;
    } catch {}
    return row;
  });

  const { data, error } = await supabase
    .from('logs')
    .insert(insertData)
    .select()
    .overrideTypes<Log[], { merge: false }>();

  if (error) {
    console.error('Error inserting logs:', error);
    throw new Error(`Failed to insert logs: ${error.message}`);
  }

  return (data as Log[]) || [];
}

// Convenience functions for common log levels
export async function logInfo(message: string, metadata?: Json, pipelineRunId?: string): Promise<Log> {
  return insertLog({ level: 'info', message, metadata, pipeline_run_id: pipelineRunId });
}

export async function logWarn(message: string, metadata?: Json, pipelineRunId?: string): Promise<Log> {
  return insertLog({ level: 'warn', message, metadata, pipeline_run_id: pipelineRunId });
}

export async function logError(message: string, metadata?: Json, pipelineRunId?: string): Promise<Log> {
  return insertLog({ level: 'error', message, metadata, pipeline_run_id: pipelineRunId });
}

// ============================================================================
// Pipeline stage logging
// ============================================================================

/**
 * Log the start of a pipeline stage.
 * Inserts an 'info' log with stage name and start timestamp in metadata.
 * Returns the Log record and a StageLogEntry for use with logStageEnd.
 */
export async function logStageStart(
  stage: PipelineStage,
  metadata?: Record<string, unknown>,
  pipelineRunId?: string
): Promise<{ log: Log; entry: StageLogEntry }> {
  const startTime = performance.now();
  const log = await insertLog({
    level: 'info',
    message: `Stage started: ${stage}`,
    metadata: {
      ...metadata,
      stage,
      stageStatus: 'started',
      stageStartMs: startTime,
    } as unknown as Json,
    pipeline_run_id: pipelineRunId,
  });
  return {
    log,
    entry: { stage, startTime, status: 'started', metadata },
  };
}

/**
 * Log the completion (or failure) of a pipeline stage.
 * Requires the StageLogEntry from the corresponding logStageStart call.
 * Accepts either the StageLogEntry directly or the full { log, entry } result
 * from logStageStart for convenience.
 * Computes durationMs automatically.
 */
export async function logStageEnd(
  startEntry: StageLogEntry | { log: Log; entry: StageLogEntry },
  overrides?: {
    status?: 'completed' | 'failed';
    error?: string;
    metadata?: Record<string, unknown>;
    pipelineRunId?: string;
  }
): Promise<Log> {
  const resolvedEntry: StageLogEntry = 'entry' in startEntry ? startEntry.entry : startEntry;
  const endTime = performance.now();
  const durationMs = Math.round(endTime - resolvedEntry.startTime);
  const status = overrides?.status ?? 'completed';

  return insertLog({
    level: status === 'failed' ? 'error' : 'info',
    message: `Stage ${status === 'failed' ? 'failed' : 'completed'}: ${resolvedEntry.stage} (${durationMs}ms)`,
    metadata: {
      ...resolvedEntry.metadata,
      ...overrides?.metadata,
      stage: resolvedEntry.stage,
      stageStatus: status,
      stageDurationMs: durationMs,
      stageStartMs: resolvedEntry.startTime,
      stageEndMs: endTime,
      ...(overrides?.error ? { error: overrides.error } : {}),
    } as unknown as Json,
    pipeline_run_id: overrides?.pipelineRunId,
  });
}