// lib/supabase/queries/runs.ts
// Query functions for oxylabs_schedule_runs table
// Service role only - no anon access per AGENTS.md Section 7

import { createServerClient } from '../client';
import type { OxylabsScheduleRun, InsertRunParams, UpdateRunParams } from '../types';

// ============================================================================
// READ QUERIES (service role only — oxylabs_schedule_runs has no anon RLS)
// ============================================================================

export async function getRunsBySchedule(scheduleId: string, limit = 50, offset = 0): Promise<OxylabsScheduleRun[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('oxylabs_schedule_runs')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
    .overrideTypes<OxylabsScheduleRun[], { merge: false }>();

  if (error) {
    console.error('Error fetching runs by schedule:', error);
    throw new Error(`Failed to fetch runs by schedule: ${error.message}`);
  }

  return (data as OxylabsScheduleRun[]) || [];
}

export async function getRunById(id: string): Promise<OxylabsScheduleRun | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('oxylabs_schedule_runs')
    .select('*')
    .eq('id', id)
    .single()
    .overrideTypes<OxylabsScheduleRun, { merge: false }>();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching run by id:', error);
    throw new Error(`Failed to fetch run: ${error.message}`);
  }

  return data as OxylabsScheduleRun;
}

export async function getRunByOxylabsRunId(oxylabsRunId: string): Promise<OxylabsScheduleRun | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('oxylabs_schedule_runs')
    .select('*')
    .eq('oxylabs_run_id', oxylabsRunId)
    .single()
    .overrideTypes<OxylabsScheduleRun, { merge: false }>();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching run by oxylabs_run_id:', error);
    throw new Error(`Failed to fetch run by oxylabs_run_id: ${error.message}`);
  }

  return data as OxylabsScheduleRun;
}

export async function getPendingRuns(scheduleId?: string): Promise<OxylabsScheduleRun[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from('oxylabs_schedule_runs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (scheduleId) {
    query = query.eq('schedule_id', scheduleId);
  }

  const { data, error } = await query.overrideTypes<OxylabsScheduleRun[], { merge: false }>();

  if (error) {
    console.error('Error fetching pending runs:', error);
    throw new Error(`Failed to fetch pending runs: ${error.message}`);
  }

  return (data as OxylabsScheduleRun[]) || [];
}

export async function getDoneRuns(scheduleId?: string, limit = 100): Promise<OxylabsScheduleRun[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from('oxylabs_schedule_runs')
    .select('*')
    .eq('status', 'done')
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (scheduleId) {
    query = query.eq('schedule_id', scheduleId);
  }

  const { data, error } = await query.overrideTypes<OxylabsScheduleRun[], { merge: false }>();

  if (error) {
    console.error('Error fetching done runs:', error);
    throw new Error(`Failed to fetch done runs: ${error.message}`);
  }

  return (data as OxylabsScheduleRun[]) || [];
}

// ============================================================================
// WRITE QUERIES (service role client)
// ============================================================================

export async function insertRun(params: InsertRunParams): Promise<OxylabsScheduleRun> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('oxylabs_schedule_runs')
    .insert({
      schedule_id: params.schedule_id,
      oxylabs_run_id: params.oxylabs_run_id,
      status: params.status,
      started_at: params.started_at ?? null,
      completed_at: params.completed_at ?? null,
      tools_found: params.tools_found ?? 0,
      tools_inserted: params.tools_inserted ?? 0,
      tools_rejected: params.tools_rejected ?? 0,
      error_message: params.error_message ?? null,
    })
    .select()
    .single()
    .overrideTypes<OxylabsScheduleRun, { merge: false }>();

  if (error) {
    console.error('Error inserting run:', error);
    throw new Error(`Failed to insert run: ${error.message}`);
  }

  return data as OxylabsScheduleRun;
}

export async function updateRun(params: UpdateRunParams): Promise<OxylabsScheduleRun> {
  const supabase = await createServerClient();

  const updates: Partial<Omit<OxylabsScheduleRun, 'id' | 'created_at'>> = {};
  if (params.status !== undefined) updates.status = params.status;
  if (params.started_at !== undefined) updates.started_at = params.started_at;
  if (params.completed_at !== undefined) updates.completed_at = params.completed_at;
  if (params.tools_found !== undefined) updates.tools_found = params.tools_found;
  if (params.tools_inserted !== undefined) updates.tools_inserted = params.tools_inserted;
  if (params.tools_rejected !== undefined) updates.tools_rejected = params.tools_rejected;
  if (params.error_message !== undefined) updates.error_message = params.error_message;

  const { data, error } = await supabase
    .from('oxylabs_schedule_runs')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()
    .overrideTypes<OxylabsScheduleRun, { merge: false }>();

  if (error) {
    console.error('Error updating run:', error);
    throw new Error(`Failed to update run: ${error.message}`);
  }

  return data as OxylabsScheduleRun;
}

export async function markRunStarted(id: string): Promise<OxylabsScheduleRun> {
  return updateRun({
    id,
    status: 'pending',
    started_at: new Date().toISOString(),
  });
}

export async function markRunDone(
  id: string,
  toolsFound: number,
  toolsInserted: number,
  toolsRejected: number
): Promise<OxylabsScheduleRun> {
  return updateRun({
    id,
    status: 'done',
    completed_at: new Date().toISOString(),
    tools_found: toolsFound,
    tools_inserted: toolsInserted,
    tools_rejected: toolsRejected,
  });
}

export async function markRunFaulted(id: string, errorMessage: string): Promise<OxylabsScheduleRun> {
  return updateRun({
    id,
    status: 'faulted',
    completed_at: new Date().toISOString(),
    error_message: errorMessage,
  });
}