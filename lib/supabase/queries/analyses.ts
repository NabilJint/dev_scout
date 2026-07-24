// lib/supabase/queries/analyses.ts
// Query functions for tool_analyses table
// Uses service role client for writes, anon/client for reads

import { createServerClient, createServerReadOnlyClient } from '../client';
import type { ToolAnalysis, InsertAnalysisParams } from '../types';

// ============================================================================
// READ QUERIES (use read-only client with anon key)
// ============================================================================

export async function getAnalysisByToolId(toolId: string): Promise<ToolAnalysis | null> {
  const supabase = await createServerReadOnlyClient();

  const { data, error } = await supabase
    .from('tool_analyses')
    .select('*')
    .eq('tool_id', toolId)
    .single()
    .overrideTypes<ToolAnalysis, { merge: false }>();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching analysis by tool_id:', error);
    throw new Error(`Failed to fetch analysis: ${error.message}`);
  }

  return data as ToolAnalysis;
}

export async function getAnalysesByCategory(category: string, limit = 50): Promise<ToolAnalysis[]> {
  const supabase = await createServerReadOnlyClient();

  const { data, error } = await supabase
    .from('tool_analyses')
    .select('*')
    .eq('category', category)
    .order('created_at', { ascending: false })
    .limit(limit)
    .overrideTypes<ToolAnalysis[], { merge: false }>();

  if (error) {
    console.error('Error fetching analyses by category:', error);
    throw new Error(`Failed to fetch analyses by category: ${error.message}`);
  }

  return (data as ToolAnalysis[]) || [];
}

export async function getAllAnalyses(limit = 100, offset = 0): Promise<ToolAnalysis[]> {
  const supabase = await createServerReadOnlyClient();

  const { data, error } = await supabase
    .from('tool_analyses')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
    .overrideTypes<ToolAnalysis[], { merge: false }>();

  if (error) {
    console.error('Error fetching all analyses:', error);
    throw new Error(`Failed to fetch all analyses: ${error.message}`);
  }

  return (data as ToolAnalysis[]) || [];
}

// ============================================================================
// WRITE QUERIES (use service role client)
// ============================================================================

export async function insertAnalysis(params: InsertAnalysisParams): Promise<ToolAnalysis> {
  const supabase = await createServerClient();

  // Validate percentages sum to 100
  const sum = params.beginner_friendly_percentage + params.balanced_percentage + params.power_user_percentage;
  if (sum !== 100) {
    throw new Error(`Percentages must sum to 100, got ${sum}`);
  }

  // Validate complexity_score matches formula
  const expectedComplexity = (params.power_user_percentage - params.beginner_friendly_percentage) / 100.0;
  if (Math.abs(params.complexity_score - expectedComplexity) > 0.001) {
    throw new Error(`complexity_score must equal (power_user_percentage - beginner_friendly_percentage) / 100. Expected ${expectedComplexity}, got ${params.complexity_score}`);
  }

  const { data, error } = await supabase
    .from('tool_analyses')
    .insert({
      tool_id: params.tool_id,
      summary: params.summary,
      adoption_score: params.adoption_score,
      adoption_label: params.adoption_label,
      tool_rating_label: params.tool_rating_label,
      beginner_friendly_percentage: params.beginner_friendly_percentage,
      balanced_percentage: params.balanced_percentage,
      power_user_percentage: params.power_user_percentage,
      complexity_score: params.complexity_score,
      confidence: params.confidence,
      main_purpose: params.main_purpose,
      category: params.category,
      target_users: params.target_users,
      key_features: params.key_features,
      pros: params.pros,
      cons: params.cons,
      pricing_model: params.pricing_model,
      integrations: params.integrations,
      best_for: params.best_for,
      marketing_buzzwords: params.marketing_buzzwords,
      rating_notes: params.rating_notes,
      disclaimer: params.disclaimer,
      model: params.model,
      embedding: params.embedding ?? null,
    })
    .select()
    .single()
    .overrideTypes<ToolAnalysis, { merge: false }>();

  if (error) {
    console.error('Error inserting analysis:', error);
    throw new Error(`Failed to insert analysis: ${error.message}`);
  }

  return data as ToolAnalysis;
}

export async function updateAnalysis(
  toolId: string,
  updates: Partial<Omit<InsertAnalysisParams, 'tool_id'>>
): Promise<ToolAnalysis> {
  const supabase = await createServerClient();

  // Validate percentages if provided
  if (
    updates.beginner_friendly_percentage !== undefined ||
    updates.balanced_percentage !== undefined ||
    updates.power_user_percentage !== undefined
  ) {
    const beginner = updates.beginner_friendly_percentage ?? 0;
    const balanced = updates.balanced_percentage ?? 0;
    const power = updates.power_user_percentage ?? 0;
    const sum = beginner + balanced + power;
    if (sum !== 100) {
      throw new Error(`Percentages must sum to 100, got ${sum}`);
    }

    if (updates.complexity_score !== undefined) {
      const expectedComplexity = (power - beginner) / 100.0;
      if (Math.abs(updates.complexity_score - expectedComplexity) > 0.001) {
        throw new Error(`complexity_score must equal (power_user_percentage - beginner_friendly_percentage) / 100. Expected ${expectedComplexity}, got ${updates.complexity_score}`);
      }
    }
  }

  const { data, error } = await supabase
    .from('tool_analyses')
    .update(updates)
    .eq('tool_id', toolId)
    .select()
    .single()
    .overrideTypes<ToolAnalysis, { merge: false }>();

  if (error) {
    console.error('Error updating analysis:', error);
    throw new Error(`Failed to update analysis: ${error.message}`);
  }

  return data as ToolAnalysis;
}

export async function deleteAnalysis(toolId: string): Promise<void> {
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('tool_analyses')
    .delete()
    .eq('tool_id', toolId);

  if (error) {
    console.error('Error deleting analysis:', error);
    throw new Error(`Failed to delete analysis: ${error.message}`);
  }
}

export async function upsertAnalysis(params: InsertAnalysisParams): Promise<ToolAnalysis> {
  const supabase = await createServerClient();

  // Validate percentages sum to 100
  const sum = params.beginner_friendly_percentage + params.balanced_percentage + params.power_user_percentage;
  if (sum !== 100) {
    throw new Error(`Percentages must sum to 100, got ${sum}`);
  }

  // Validate complexity_score matches formula
  const expectedComplexity = (params.power_user_percentage - params.beginner_friendly_percentage) / 100.0;
  if (Math.abs(params.complexity_score - expectedComplexity) > 0.001) {
    throw new Error(`complexity_score must equal (power_user_percentage - beginner_friendly_percentage) / 100. Expected ${expectedComplexity}, got ${params.complexity_score}`);
  }

  const { data, error } = await supabase
    .from('tool_analyses')
    .upsert({
      tool_id: params.tool_id,
      summary: params.summary,
      adoption_score: params.adoption_score,
      adoption_label: params.adoption_label,
      tool_rating_label: params.tool_rating_label,
      beginner_friendly_percentage: params.beginner_friendly_percentage,
      balanced_percentage: params.balanced_percentage,
      power_user_percentage: params.power_user_percentage,
      complexity_score: params.complexity_score,
      confidence: params.confidence,
      main_purpose: params.main_purpose,
      category: params.category,
      target_users: params.target_users,
      key_features: params.key_features,
      pros: params.pros,
      cons: params.cons,
      pricing_model: params.pricing_model,
      integrations: params.integrations,
      best_for: params.best_for,
      marketing_buzzwords: params.marketing_buzzwords,
      rating_notes: params.rating_notes,
      disclaimer: params.disclaimer,
      model: params.model,
      ...(params.embedding !== undefined ? { embedding: params.embedding } : {}),
    }, {
      onConflict: 'tool_id',
    })
    .select()
    .single()
    .overrideTypes<ToolAnalysis, { merge: false }>();

  if (error) {
    console.error('Error upserting analysis:', error);
    throw new Error(`Failed to upsert analysis: ${error.message}`);
  }

  return data as ToolAnalysis;
}