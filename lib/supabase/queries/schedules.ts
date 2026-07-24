// lib/supabase/queries/schedules.ts
// Query functions for oxylabs_schedules table
// Service role only - no anon access per AGENTS.md Section 7

import { createServerClient } from '../client';
import type { OxylabsSchedule, InsertScheduleParams, UpdateScheduleParams } from '../types';

// ============================================================================
// READ QUERIES (service role only — oxylabs_schedules has no anon RLS)
// ============================================================================

export async function getSchedules(activeOnly = false): Promise<OxylabsSchedule[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from('oxylabs_schedules')
    .select('*')
    .order('created_at', { ascending: false });

  if (activeOnly) {
    query = query.eq('active', true);
  }

  const { data, error } = await query.overrideTypes<OxylabsSchedule[], { merge: false }>();

  if (error) {
    console.error('Error fetching schedules:', error);
    throw new Error(`Failed to fetch schedules: ${error.message}`);
  }

  return (data as OxylabsSchedule[]) || [];
}

export async function getScheduleById(id: string): Promise<OxylabsSchedule | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('oxylabs_schedules')
    .select('*')
    .eq('id', id)
    .single()
    .overrideTypes<OxylabsSchedule, { merge: false }>();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching schedule by id:', error);
    throw new Error(`Failed to fetch schedule: ${error.message}`);
  }

  return data as OxylabsSchedule;
}

export async function getScheduleBySourceId(sourceId: string): Promise<OxylabsSchedule | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('oxylabs_schedules')
    .select('*')
    .eq('source_id', sourceId)
    .single()
    .overrideTypes<OxylabsSchedule, { merge: false }>();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching schedule by source_id:', error);
    throw new Error(`Failed to fetch schedule by source_id: ${error.message}`);
  }

  return data as OxylabsSchedule;
}

export async function getScheduleByOxylabsId(oxylabsScheduleId: string): Promise<OxylabsSchedule | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('oxylabs_schedules')
    .select('*')
    .eq('oxylabs_schedule_id', oxylabsScheduleId)
    .single()
    .overrideTypes<OxylabsSchedule, { merge: false }>();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching schedule by oxylabs_schedule_id:', error);
    throw new Error(`Failed to fetch schedule by oxylabs_schedule_id: ${error.message}`);
  }

  return data as OxylabsSchedule;
}

// ============================================================================
// WRITE QUERIES (service role client)
// ============================================================================

export async function insertSchedule(params: InsertScheduleParams): Promise<OxylabsSchedule> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('oxylabs_schedules')
    .insert({
      oxylabs_schedule_id: params.oxylabs_schedule_id,
      source_id: params.source_id,
      active: params.active ?? true,
    })
    .select()
    .single()
    .overrideTypes<OxylabsSchedule, { merge: false }>();

  if (error) {
    console.error('Error inserting schedule:', error);
    throw new Error(`Failed to insert schedule: ${error.message}`);
  }

  return data as OxylabsSchedule;
}

export async function updateSchedule(params: UpdateScheduleParams): Promise<OxylabsSchedule> {
  const supabase = await createServerClient();

  const updates: Partial<Omit<OxylabsSchedule, 'id' | 'created_at'>> = {};
  if (params.oxylabs_schedule_id !== undefined) updates.oxylabs_schedule_id = params.oxylabs_schedule_id;
  if (params.active !== undefined) updates.active = params.active;

  const { data, error } = await supabase
    .from('oxylabs_schedules')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updates as any)
    .eq('id', params.id)
    .select()
    .single()
    .overrideTypes<OxylabsSchedule, { merge: false }>();

  if (error) {
    console.error('Error updating schedule:', error);
    throw new Error(`Failed to update schedule: ${error.message}`);
  }

  return data as OxylabsSchedule;
}

export async function deactivateSchedule(id: string): Promise<OxylabsSchedule> {
  return updateSchedule({ id, active: false });
}

export async function activateSchedule(id: string): Promise<OxylabsSchedule> {
  return updateSchedule({ id, active: true });
}

export async function deleteSchedule(id: string): Promise<void> {
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('oxylabs_schedules')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting schedule:', error);
    throw new Error(`Failed to delete schedule: ${error.message}`);
  }
}

// ============================================================================
// ORPHAN SCHEDULE DEACTIVATION (per AGENTS.md Section 18)
// ============================================================================

export async function deactivateOrphanSchedules(validOxylabsScheduleIds: string[]): Promise<number> {
  const supabase = await createServerClient();

  // Get all schedules from Oxylabs (this would be called after fetching from Oxylabs API)
  // For now, we deactivate schedules in our DB that are not in the valid list
  // The actual Oxylabs API call to deactivate is done by the caller

  const { data: dbSchedules, error: fetchError } = await supabase
    .from('oxylabs_schedules')
    .select('id, oxylabs_schedule_id')
    .eq('active', true)
    .overrideTypes<Pick<OxylabsSchedule, 'id' | 'oxylabs_schedule_id'>[], { merge: false }>();

  if (fetchError) {
    console.error('Error fetching active schedules:', fetchError);
    throw new Error(`Failed to fetch active schedules: ${fetchError.message}`);
  }

  const validIdsSet = new Set(validOxylabsScheduleIds);
  const orphanSchedules = (dbSchedules || []).filter(s => !validIdsSet.has(s.oxylabs_schedule_id));

  if (orphanSchedules.length === 0) {
    return 0;
  }

  const orphanIds = orphanSchedules.map(s => s.id);

  const { error: updateError } = await supabase
    .from('oxylabs_schedules')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ active: false } as any)
    .in('id', orphanIds);

  if (updateError) {
    console.error('Error deactivating orphan schedules:', updateError);
    throw new Error(`Failed to deactivate orphan schedules: ${updateError.message}`);
  }

  return orphanSchedules.length;
}