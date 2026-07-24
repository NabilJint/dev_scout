// lib/supabase/queries/tools.ts
// Query functions for tools table
// Uses service role client for writes, anon/client for reads

import { createServerClient, createServerReadOnlyClient } from '../client';
import type { Tool, ToolWithSource, ToolWithAnalysis, InsertToolParams, UpdateToolAnalyzedAtParams, GetToolsParams, MatchRelatedToolsResult } from '../types';

// ============================================================================
// READ QUERIES (use read-only client with anon key)
// ============================================================================

export async function getTools(params: GetToolsParams = {}): Promise<ToolWithAnalysis[]> {
  const { limit = 50, offset = 0, sourceId, analyzedOnly = true, category, curationStatus } = params;
  const supabase = await createServerReadOnlyClient();

  // DIAGNOSTIC: Log which Supabase project we're connecting to
  console.log('🔌 [getTools] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('🔌 [getTools] Query params:', { limit, offset, sourceId, analyzedOnly, category, curationStatus });

  let query = supabase
    .from('tools')
    .select(`
      *,
      tool_sources (*),
      tool_analyses (*)
    `)
    .order('last_updated', { ascending: false })
    .range(offset, offset + limit - 1);

  if (sourceId) {
    query = query.eq('source_id', sourceId);
  }

  if (analyzedOnly) {
    query = query.not('analyzed_at', 'is', null);
  }

  // Filter by curation status (in memory to avoid PostgREST joined table gotcha)
  const { data, error } = await query.overrideTypes<ToolWithAnalysis[], { merge: false }>();

  if (error) {
    console.error('Error fetching tools:', error);
    throw new Error(`Failed to fetch tools: ${error.message}`);
  }

  let tools = (data as ToolWithAnalysis[]) || [];

  // Filter by category in memory since it's on the joined tool_analyses table
  if (category && category !== 'All') {
    tools = tools.filter(tool => tool.tool_analyses?.category === category);
  }

  // Filter by curation status in memory (per AGENTS.md §21: joined table filter gotcha)
  // If the column doesn't exist (undefined), still show the tool
  if (curationStatus && curationStatus.length > 0) {
    tools = tools.filter(tool =>
      tool.curation_status === undefined || curationStatus.includes(tool.curation_status)
    );
  }

  return tools;
}

export async function getToolById(id: string): Promise<ToolWithAnalysis | null> {
  const supabase = await createServerReadOnlyClient();

  const { data, error } = await supabase
    .from('tools')
    .select(`
      *,
      tool_sources (*),
      tool_analyses (*)
    `)
    .eq('id', id)
    .single()
    .overrideTypes<ToolWithAnalysis, { merge: false }>();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching tool by id:', error);
    throw new Error(`Failed to fetch tool: ${error.message}`);
  }

  return data as ToolWithAnalysis;
}

export async function getToolsBySource(sourceId: string, limit = 50, offset = 0): Promise<ToolWithSource[]> {
  const supabase = await createServerReadOnlyClient();

  const { data, error } = await supabase
    .from('tools')
    .select(`
      *,
      tool_sources (*)
    `)
    .eq('source_id', sourceId)
    .order('last_updated', { ascending: false })
    .range(offset, offset + limit - 1)
    .overrideTypes<ToolWithSource[], { merge: false }>();

  if (error) {
    console.error('Error fetching tools by source:', error);
    throw new Error(`Failed to fetch tools by source: ${error.message}`);
  }

  return (data as ToolWithSource[]) || [];
}

export async function getPendingAnalysisTools(limit = 50): Promise<Tool[]> {
  const supabase = await createServerClient();

  // Step 1: Get all tool IDs that already have analyses
  const { data: analyzedData, error: analyzedError } = await supabase
    .from('tool_analyses')
    .select('tool_id');

  if (analyzedError) {
    console.error('Error fetching analyzed tool IDs:', analyzedError);
    throw new Error(`Failed to fetch analyzed tool IDs: ${analyzedError.message}`);
  }

  const analyzedToolIds = new Set((analyzedData || []).map(row => row.tool_id));

  // Step 2: Fetch all tools
  const { data: allTools, error: toolsError } = await supabase
    .from('tools')
    .select('*')
    .order('scraped_at', { ascending: true });

  if (toolsError) {
    console.error('Error fetching pending analysis tools:', toolsError);
    throw new Error(`Failed to fetch pending analysis tools: ${toolsError.message}`);
  }

  // Step 3: Filter in JavaScript — only tools without analysis rows are pending
  const pending = (allTools || []).filter(tool => !analyzedToolIds.has(tool.id));

  // Step 3b: Exclude rejected tools (they stay in DB but skip analysis)
  const rejectedCount = pending.filter(tool => tool.curation_status === 'rejected').length;
  if (rejectedCount > 0) {
    console.log(`  ℹ️  [Analysis] Skipped ${rejectedCount} rejected tools (curation_status = 'rejected')`);
  }
  const validPending = pending.filter(tool => tool.curation_status !== 'rejected');

  // Step 4: Return up to the requested limit
  return validPending.slice(0, limit);
}

export async function getToolsWithoutEmbeddings(limit = 50): Promise<Tool[]> {
  const supabase = await createServerClient();

  // Step 1: Get tool_ids from tool_analyses where embedding IS NULL
  const { data: incompleteData, error: incompleteError } = await supabase
    .from('tool_analyses')
    .select('tool_id')
    .is('embedding', null);

  if (incompleteError) {
    console.error('Error fetching tool IDs without embeddings:', incompleteError);
    throw new Error(`Failed to fetch tool IDs: ${incompleteError.message}`);
  }

  if (!incompleteData || incompleteData.length === 0) return [];

  const toolIds = incompleteData.map(row => row.tool_id);

  // Step 2: Fetch the actual tools
  const { data: tools, error: toolsError } = await supabase
    .from('tools')
    .select('*')
    .in('id', toolIds)
    .order('analyzed_at', { ascending: true })
    .limit(limit);

  if (toolsError) {
    console.error('Error fetching tools without embeddings:', toolsError);
    throw new Error(`Failed to fetch tools: ${toolsError.message}`);
  }

  // Step 3: Exclude rejected tools (they stay in DB but skip embedding generation)
  const validTools = (tools || []).filter(t => t.curation_status !== 'rejected');

  return validTools as Tool[];
}

export async function getToolCount(analyzedOnly = true): Promise<number> {
  const supabase = await createServerReadOnlyClient();

  let query = supabase.from('tools').select('*', { count: 'exact', head: true });

  if (analyzedOnly) {
    query = query.not('analyzed_at', 'is', null);
  }

  const { count, error } = await query;

  if (error) {
    console.error('Error counting tools:', error);
    throw new Error(`Failed to count tools: ${error.message}`);
  }

  return count || 0;
}

export async function getRelatedTools(
  toolId: string,
  embedding: number[],
  options: { threshold?: number; count?: number } = {}
): Promise<MatchRelatedToolsResult[]> {
  const supabase = await createServerReadOnlyClient();

  const { threshold = 0.5, count = 6 } = options;

  const { data, error } = await supabase.rpc('match_related_tools', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: count,
  });

  if (error) {
    console.error('Error fetching related tools:', error);
    return [];
  }

  // Filter out the current tool by ID
  const results = (data || []) as MatchRelatedToolsResult[];
  return results.filter(tool => tool.tool_id !== toolId);
}

// ============================================================================
// WRITE QUERIES (use service role client)
// ============================================================================

export async function insertTool(params: InsertToolParams): Promise<Tool> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('tools')
    .insert({
      source_id: params.source_id,
      original_url: params.original_url,
      canonical_url: params.canonical_url,
      name: params.name,
      brand_text: params.brand_text ?? null,
      image_url: params.image_url,
      website_url: params.website_url ?? null,
      curation_status: params.curation_status ?? 'auto-suggested',
      last_updated: params.last_updated,
      raw_text: params.raw_text ?? null,
    })
    .select()
    .single()
    .overrideTypes<Tool, { merge: false }>();

  if (error) {
    console.error('Error inserting tool:', error);
    throw new Error(`Failed to insert tool: ${error.message}`);
  }

  return data as Tool;
}

export async function insertTools(tools: InsertToolParams[]): Promise<Tool[]> {
  if (tools.length === 0) return [];

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('tools')
    .insert(tools.map(t => ({
      source_id: t.source_id,
      original_url: t.original_url,
      canonical_url: t.canonical_url,
      name: t.name,
      brand_text: t.brand_text ?? null,
      image_url: t.image_url,
      website_url: t.website_url ?? null,
      curation_status: t.curation_status ?? 'auto-suggested',
      last_updated: t.last_updated,
      raw_text: t.raw_text ?? null,
    })))
    .select()
    .overrideTypes<Tool[], { merge: false }>();

  if (error) {
    console.error('Error inserting tools:', error);
    throw new Error(`Failed to insert tools: ${error.message}`);
  }

  return (data as Tool[]) || [];
}

export async function updateToolAnalyzedAt(params: UpdateToolAnalyzedAtParams): Promise<Tool> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('tools')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ analyzed_at: params.analyzed_at } as any)
    .eq('id', params.id)
    .select()
    .single()
    .overrideTypes<Tool, { merge: false }>();

  if (error) {
    console.error('Error updating tool analyzed_at:', error);
    throw new Error(`Failed to update tool analyzed_at: ${error.message}`);
  }

  return data as Tool;
}

export async function updateToolRawText(id: string, rawText: string): Promise<Tool> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('tools')
    .update({ raw_text: rawText })
    .eq('id', id)
    .select()
    .single()
    .overrideTypes<Tool, { merge: false }>();

  if (error) {
    console.error('Error updating tool raw_text:', error);
    throw new Error(`Failed to update tool raw_text: ${error.message}`);
  }

  return data as Tool;
}

export async function checkToolsExistByOriginalUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();

  const supabase = await createServerReadOnlyClient();

  // Query in chunks of 15 to avoid PostgREST URL length limits (per AGENTS.md Section 9)
  const chunkSize = 15;
  const existingUrls = new Set<string>();

  for (let i = 0; i < urls.length; i += chunkSize) {
    const chunk = urls.slice(i, i + chunkSize);

    const { data, error } = await supabase
      .from('tools')
      .select('original_url')
      .in('original_url', chunk);

    if (error) {
      console.error('Error checking tool existence:', error);
      throw new Error(`Failed to check tool existence: ${error.message}`);
    }

    data?.forEach(tool => existingUrls.add(tool.original_url));
  }

  return existingUrls;
}