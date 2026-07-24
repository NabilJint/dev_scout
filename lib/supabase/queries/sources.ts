// lib/supabase/queries/sources.ts
// Query functions for tool_sources table
// Uses service role client for writes, anon/client for reads

import { createServerClient, createServerReadOnlyClient } from '../client';
import type { ToolSource, InsertSourceParams, UpdateSourceParams } from '../types';

// ============================================================================
// READ QUERIES (use read-only client with anon key)
// ============================================================================

export async function getActiveSources(): Promise<ToolSource[]> {
  const supabase = await createServerReadOnlyClient();

  const { data, error } = await supabase
    .from('tool_sources')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true })
    .overrideTypes<ToolSource[], { merge: false }>();

  if (error) {
    console.error('Error fetching active sources:', error);
    throw new Error(`Failed to fetch active sources: ${error.message}`);
  }

  return (data as ToolSource[]) || [];
}

export async function getAllSources(): Promise<ToolSource[]> {
  const supabase = await createServerReadOnlyClient();

  const { data, error } = await supabase
    .from('tool_sources')
    .select('*')
    .order('name', { ascending: true })
    .overrideTypes<ToolSource[], { merge: false }>();

  if (error) {
    console.error('Error fetching all sources:', error);
    throw new Error(`Failed to fetch all sources: ${error.message}`);
  }

  return (data as ToolSource[]) || [];
}

export async function getSourceById(id: string): Promise<ToolSource | null> {
  const supabase = await createServerReadOnlyClient();

  const { data, error } = await supabase
    .from('tool_sources')
    .select('*')
    .eq('id', id)
    .single()
    .overrideTypes<ToolSource, { merge: false }>();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching source by id:', error);
    throw new Error(`Failed to fetch source: ${error.message}`);
  }

  return data as ToolSource;
}

export async function getSourceByListingUrl(listingUrl: string): Promise<ToolSource | null> {
  const supabase = await createServerReadOnlyClient();

  const { data, error } = await supabase
    .from('tool_sources')
    .select('*')
    .eq('listing_url', listingUrl)
    .single()
    .overrideTypes<ToolSource, { merge: false }>();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching source by listing_url:', error);
    throw new Error(`Failed to fetch source by listing_url: ${error.message}`);
  }

  return data as ToolSource;
}

// ============================================================================
// WRITE QUERIES (use service role client)
// ============================================================================

export async function insertSource(params: InsertSourceParams): Promise<ToolSource> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('tool_sources')
    .insert({
      name: params.name,
      listing_url: params.listing_url,
      logo_url: params.logo_url ?? null,
      active: params.active ?? true,
      parser_strategy: params.parser_strategy ?? null,
    })
    .select()
    .single()
    .overrideTypes<ToolSource, { merge: false }>();

  if (error) {
    console.error('Error inserting source:', error);
    throw new Error(`Failed to insert source: ${error.message}`);
  }

  return data as ToolSource;
}

export async function updateSource(params: UpdateSourceParams): Promise<ToolSource> {
  const supabase = await createServerClient();

  const updates: Partial<Omit<ToolSource, 'id' | 'created_at'>> = {};
  if (params.name !== undefined) updates.name = params.name;
  if (params.listing_url !== undefined) updates.listing_url = params.listing_url;
  if (params.logo_url !== undefined) updates.logo_url = params.logo_url;
  if (params.active !== undefined) updates.active = params.active;
  if (params.parser_strategy !== undefined) updates.parser_strategy = params.parser_strategy;

  const { data, error } = await supabase
    .from('tool_sources')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()
    .overrideTypes<ToolSource, { merge: false }>();

  if (error) {
    console.error('Error updating source:', error);
    throw new Error(`Failed to update source: ${error.message}`);
  }

  return data as ToolSource;
}

export async function deactivateSource(id: string): Promise<ToolSource> {
  return updateSource({ id, active: false });
}

export async function activateSource(id: string): Promise<ToolSource> {
  return updateSource({ id, active: true });
}

export async function deleteSource(id: string): Promise<void> {
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('tool_sources')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting source:', error);
    throw new Error(`Failed to delete source: ${error.message}`);
  }
}