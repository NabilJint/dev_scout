// lib/supabase/queries/logs.ts
// Query functions for logs table
// Service role only - no anon access per AGENTS.md Section 7. All reads use createServerClient().

import { createServerClient } from '../client';
import type { Log, InsertLogParams, GetLogsParams, Json } from '../types';

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

  const { data, error } = await supabase
    .from('logs')
    .insert({
      level: params.level,
      message: params.message,
      metadata: params.metadata ?? null,
    })
    .select()
    .single()
    .overrideTypes<Log, { merge: false }>();

  if (error) {
    console.error('Error inserting log:', error);
    throw new Error(`Failed to insert log: ${error.message}`);
  }

  return data as Log;
}

export async function insertLogs(logs: InsertLogParams[]): Promise<Log[]> {
  if (logs.length === 0) return [];

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('logs')
    .insert(logs.map(l => ({
      level: l.level,
      message: l.message,
      metadata: l.metadata ?? null,
    })))
    .select()
    .overrideTypes<Log[], { merge: false }>();

  if (error) {
    console.error('Error inserting logs:', error);
    throw new Error(`Failed to insert logs: ${error.message}`);
  }

  return (data as Log[]) || [];
}

// Convenience functions for common log levels
export async function logInfo(message: string, metadata?: Json): Promise<Log> {
  return insertLog({ level: 'info', message, metadata });
}

export async function logWarn(message: string, metadata?: Json): Promise<Log> {
  return insertLog({ level: 'warn', message, metadata });
}

export async function logError(message: string, metadata?: Json): Promise<Log> {
  return insertLog({ level: 'error', message, metadata });
}