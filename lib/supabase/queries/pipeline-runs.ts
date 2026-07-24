// lib/supabase/queries/pipeline-runs.ts
// Query functions for pipeline_runs table
// Service role only — no anon access per AGENTS.md Section 7

import { createServerClient } from '../client';
import type { PipelineRun, InsertPipelineRunParams, UpdatePipelineRunParams, Json } from '../types';

/**
 * Create a new pipeline run entry.
 */
export async function createPipelineRun(params: InsertPipelineRunParams): Promise<PipelineRun> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('pipeline_runs')
    .insert({
      run_id: params.run_id,
      trigger: params.trigger,
      status: params.status ?? 'started',
      summary: params.summary ?? null,
      error: params.error ?? null,
      completed_at: params.completed_at ?? null,
    })
    .select()
    .single()
    .overrideTypes<PipelineRun, { merge: false }>();

  if (error) {
    console.error('Error creating pipeline run:', error);
    throw new Error(`Failed to create pipeline run: ${error.message}`);
  }

  return data as PipelineRun;
}

/**
 * Update an existing pipeline run by run_id.
 */
export async function updatePipelineRun(
  runId: string,
  params: UpdatePipelineRunParams
): Promise<PipelineRun> {
  const supabase = await createServerClient();

  const updates: Record<string, unknown> = {};
  if (params.status !== undefined) updates.status = params.status;
  if (params.summary !== undefined) updates.summary = params.summary;
  if (params.error !== undefined) updates.error = params.error;
  if (params.completed_at !== undefined) updates.completed_at = params.completed_at;

  const { data, error } = await supabase
    .from('pipeline_runs')
    .update(updates)
    .eq('run_id', runId)
    .select()
    .single()
    .overrideTypes<PipelineRun, { merge: false }>();

  if (error) {
    console.error('Error updating pipeline run:', error);
    throw new Error(`Failed to update pipeline run: ${error.message}`);
  }

  return data as PipelineRun;
}

/**
 * Mark a pipeline run as completed with its summary.
 */
export async function completePipelineRun(
  runId: string,
  summary: Record<string, unknown>
): Promise<PipelineRun> {
  return updatePipelineRun(runId, {
    status: 'completed',
    summary: summary as unknown as Json,
    completed_at: new Date().toISOString(),
  });
}

/**
 * Mark a pipeline run as failed with an error message.
 */
export async function failPipelineRun(
  runId: string,
  error: string,
  summary?: Record<string, unknown> | null
): Promise<PipelineRun> {
  return updatePipelineRun(runId, {
    status: 'failed',
    summary: (summary ?? null) as unknown as Json | null,
    error,
    completed_at: new Date().toISOString(),
  });
}

/**
 * Get a pipeline run by run_id.
 */
export async function getPipelineRun(runId: string): Promise<PipelineRun | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('run_id', runId)
    .single()
    .overrideTypes<PipelineRun, { merge: false }>();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching pipeline run:', error);
    throw new Error(`Failed to fetch pipeline run: ${error.message}`);
  }

  return data as PipelineRun;
}

/**
 * List pipeline runs with pagination.
 */
export async function listPipelineRuns(
  options: {
    limit?: number;
    offset?: number;
    trigger?: 'manual' | 'cron' | 'scheduler' | 'analysis';
    status?: string;
  } = {}
): Promise<PipelineRun[]> {
  const supabase = await createServerClient();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  let query = supabase
    .from('pipeline_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.trigger) {
    query = query.eq('trigger', options.trigger);
  }

  if (options.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query.overrideTypes<PipelineRun[], { merge: false }>();

  if (error) {
    console.error('Error listing pipeline runs:', error);
    throw new Error(`Failed to list pipeline runs: ${error.message}`);
  }

  return (data as PipelineRun[]) || [];
}
