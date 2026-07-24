// lib/supabase/queries/research-documents.ts
// Query functions for research_documents table
// Uses service role client for writes

import { createServerClient } from '../client';
import type { ResearchDocument, InsertResearchDocumentParams } from '../types';

// ============================================================================
// WRITE QUERIES (use service role client)
// ============================================================================

/**
 * Upsert a research document for a tool.
 * If a row with the same tool_id already exists, it is updated.
 *
 * The research document stores fetched content from the tool's homepage,
 * docs page, pricing page, and GitHub README — used to enrich AI analysis.
 */
export async function upsertResearchDoc(
  params: InsertResearchDocumentParams
): Promise<ResearchDocument> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('research_documents')
    .upsert({
      tool_id: params.tool_id,
      homepage_md: params.homepage_md,
      docs_md: params.docs_md,
      pricing_md: params.pricing_md,
      github_readme_md: params.github_readme_md,
      metadata: params.metadata ?? null,
      content_hash: params.content_hash ?? null,
    }, {
      onConflict: 'tool_id',
    })
    .select()
    .single()
    .overrideTypes<ResearchDocument, { merge: false }>();

  if (error) {
    console.error('Error upserting research document:', error);
    throw new Error(`Failed to upsert research document: ${error.message}`);
  }

  return data as ResearchDocument;
}

/**
 * Get a research document by tool ID.
 */
export async function getResearchDocByToolId(
  toolId: string
): Promise<ResearchDocument | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('research_documents')
    .select('*')
    .eq('tool_id', toolId)
    .single()
    .overrideTypes<ResearchDocument, { merge: false }>();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching research document by tool_id:', error);
    throw new Error(`Failed to fetch research document: ${error.message}`);
  }

  return data as ResearchDocument;
}
