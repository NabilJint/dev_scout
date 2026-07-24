// lib/supabase/types.ts
// TypeScript types matching the Supabase schema exactly
// Generated from supabase/schema.sql

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface ToolSource {
  id: string;
  name: string;
  listing_url: string;
  logo_url: string | null;
  active: boolean;
  parser_strategy: string | null;
  created_at: string;
}

export interface Tool {
  id: string;
  source_id: string;
  original_url: string;
  canonical_url: string;
  name: string;
  brand_text: string | null;
  image_url: string;
  website_url: string | null;
  curation_status: string;
  last_updated: string;
  raw_text: string | null;
  scraped_at: string;
  analyzed_at: string | null;
  created_at: string;
}

export interface ToolAnalysis {
  id: string;
  tool_id: string;
  summary: string;
  subtitle: string;
  adoption_score: number;
  adoption_label: 'early-stage' | 'growing' | 'established';
  tool_rating_label: 'beginner-friendly' | 'balanced' | 'power-user' | 'mixed' | 'unclear';
  beginner_friendly_percentage: number;
  balanced_percentage: number;
  power_user_percentage: number;
  complexity_score: number;
  confidence: number;
  main_purpose: string;
  category: string;
  target_users: string;
  key_features: string[];
  pros: string[];
  cons: string[];
  pricing_model: 'free' | 'freemium' | 'paid' | 'usage-based' | 'enterprise' | 'unclear';
  integrations: string[];
  best_for: string;
  marketing_buzzwords: string[];
  rating_notes: string;
  disclaimer: string;
  model: string;
  embedding: string | null; // vector(1024) from pgvector
  created_at: string;
}

export interface Log {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata: Json | null;
  created_at: string;
}

export interface OxylabsSchedule {
  id: string;
  oxylabs_schedule_id: string; // Large int stored as TEXT
  source_id: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OxylabsScheduleRun {
  id: string;
  schedule_id: string;
  oxylabs_run_id: string; // Large int stored as TEXT
  status: 'pending' | 'done' | 'faulted';
  started_at: string | null;
  completed_at: string | null;
  tools_found: number;
  tools_inserted: number;
  tools_rejected: number;
  error_message: string | null;
  created_at: string;
}

// Joined types for common queries
export interface ToolWithSource extends Tool {
  tool_sources: ToolSource;
}

export interface ToolWithAnalysis extends Tool {
  tool_analyses: ToolAnalysis | null;
  tool_sources: ToolSource;
}

export interface ToolAnalysisWithTool extends ToolAnalysis {
  tools: Tool;
}

// Query parameter types
export interface GetToolsParams {
  limit?: number;
  offset?: number;
  sourceId?: string;
  analyzedOnly?: boolean;
  category?: string;
  curationStatus?: string[];
}

export interface GetLogsParams {
  limit?: number;
  offset?: number;
  level?: 'info' | 'warn' | 'error';
  since?: string;
}

export interface InsertLogParams {
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Json | null;
}

export interface InsertToolParams {
  source_id: string;
  original_url: string;
  canonical_url: string;
  name: string;
  brand_text?: string | null;
  image_url: string;
  website_url?: string | null;
  curation_status?: string;
  last_updated: string;
  raw_text?: string | null;
}

export interface UpdateToolAnalyzedAtParams {
  id: string;
  analyzed_at: string;
}

export interface InsertAnalysisParams {
  tool_id: string;
  summary: string;
  subtitle: string;
  adoption_score: number;
  adoption_label: 'early-stage' | 'growing' | 'established';
  tool_rating_label: 'beginner-friendly' | 'balanced' | 'power-user' | 'mixed' | 'unclear';
  beginner_friendly_percentage: number;
  balanced_percentage: number;
  power_user_percentage: number;
  complexity_score: number;
  confidence: number;
  main_purpose: string;
  category: string;
  target_users: string;
  key_features: string[];
  pros: string[];
  cons: string[];
  pricing_model: 'free' | 'freemium' | 'paid' | 'usage-based' | 'enterprise' | 'unclear';
  integrations: string[];
  best_for: string;
  marketing_buzzwords: string[];
  rating_notes: string;
  disclaimer: string;
  model: string;
  embedding?: number[] | null;
}

export interface InsertSourceParams {
  name: string;
  listing_url: string;
  logo_url?: string | null;
  active?: boolean;
  parser_strategy?: string | null;
}

export interface UpdateSourceParams {
  id: string;
  name?: string;
  listing_url?: string;
  logo_url?: string | null;
  active?: boolean;
  parser_strategy?: string | null;
}

export interface InsertScheduleParams {
  oxylabs_schedule_id: string;
  source_id: string;
  active?: boolean;
}

export interface UpdateScheduleParams {
  id: string;
  active?: boolean;
  oxylabs_schedule_id?: string;
}

export interface InsertRunParams {
  schedule_id: string;
  oxylabs_run_id: string;
  status: 'pending' | 'done' | 'faulted';
  started_at?: string | null;
  completed_at?: string | null;
  tools_found?: number;
  tools_inserted?: number;
  tools_rejected?: number;
  error_message?: string | null;
}

export interface UpdateRunParams {
  id: string;
  status?: 'pending' | 'done' | 'faulted';
  started_at?: string | null;
  completed_at?: string | null;
  tools_found?: number;
  tools_inserted?: number;
  tools_rejected?: number;
  error_message?: string | null;
}

export interface MatchRelatedToolsResult {
  id: string;
  tool_id: string;
  tool_name: string;
  tool_image_url: string;
  tool_slug: string;
  similarity: number;
}

// Database type for Supabase client - matches the exact structure expected by supabase-js
export type Database = {
  public: {
    Tables: {
      tool_sources: {
        Row: ToolSource;
        Insert: Omit<ToolSource, 'id' | 'created_at'>;
        Update: Partial<Omit<ToolSource, 'id' | 'created_at'>>;
        Relationships: [];
      };
      tools: {
        Row: Tool;
        Insert: Omit<Tool, 'id' | 'scraped_at' | 'created_at' | 'analyzed_at'>;
        Update: Partial<Omit<Tool, 'id' | 'scraped_at' | 'created_at' | 'analyzed_at'>>;
        Relationships: [
          {
            foreignKeyName: "tools_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "tool_sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tool_analyses_tool_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "tool_analyses";
            referencedColumns: ["tool_id"];
          }
        ];
      };
      tool_analyses: {
        Row: ToolAnalysis;
        Insert: Omit<ToolAnalysis, 'id' | 'created_at'>;
        Update: Partial<Omit<ToolAnalysis, 'id' | 'created_at'>>;
        Relationships: [
          {
            foreignKeyName: "tool_analyses_tool_id_fkey";
            columns: ["tool_id"];
            isOneToOne: false;
            referencedRelation: "tools";
            referencedColumns: ["id"];
          }
        ];
      };
      logs: {
        Row: Log;
        Insert: Omit<Log, 'id' | 'created_at'>;
        Update: Partial<Omit<Log, 'id' | 'created_at'>>;
        Relationships: [];
      };
      oxylabs_schedules: {
        Row: OxylabsSchedule;
        Insert: Omit<OxylabsSchedule, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<OxylabsSchedule, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [
          {
            foreignKeyName: "oxylabs_schedules_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "tool_sources";
            referencedColumns: ["id"];
          }
        ];
      };
      oxylabs_schedule_runs: {
        Row: OxylabsScheduleRun;
        Insert: Omit<OxylabsScheduleRun, 'id' | 'created_at'>;
        Update: Partial<Omit<OxylabsScheduleRun, 'id' | 'created_at'>>;
        Relationships: [
          {
            foreignKeyName: "oxylabs_schedule_runs_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "oxylabs_schedules";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_related_tools: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
        };
        Returns: MatchRelatedToolsResult[];
      };
    };
    Enums: {
      adoption_label: 'early-stage' | 'growing' | 'established';
      tool_rating_label: 'beginner-friendly' | 'balanced' | 'power-user' | 'mixed' | 'unclear';
      pricing_model: 'free' | 'freemium' | 'paid' | 'usage-based' | 'enterprise' | 'unclear';
      log_level: 'info' | 'warn' | 'error';
      run_status: 'pending' | 'done' | 'faulted';
    };
    CompositeTypes: Record<string, never>;
  };
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
};