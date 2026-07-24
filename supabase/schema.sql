-- DevScout AI Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor
-- This creates all 6 core tables with RLS policies and indexes

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================================
-- TABLE: tool_sources
-- ============================================================================
create table if not exists public.tool_sources (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    listing_url text not null unique,
    logo_url text,
    active boolean not null default true,
    parser_strategy text,
    created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_tool_sources_active on public.tool_sources (active);
create index if not exists idx_tool_sources_listing_url on public.tool_sources (listing_url);

-- RLS
alter table public.tool_sources enable row level security;

-- Anon can read active sources
drop policy if exists "tool_sources_anon_select_active" on public.tool_sources;
create policy "tool_sources_anon_select_active"
    on public.tool_sources
    for select
    to anon
    using (active = true);

-- Service role has full access
drop policy if exists "tool_sources_service_role_all" on public.tool_sources;
create policy "tool_sources_service_role_all"
    on public.tool_sources
    for all
    to service_role
    using (true)
    with check (true);

-- ============================================================================
-- TABLE: tools
-- ============================================================================
create table if not exists public.tools (
    id uuid primary key default gen_random_uuid(),
    source_id uuid not null references public.tool_sources(id) on delete cascade,
    original_url text not null unique,
    canonical_url text not null,
    name text not null,
    brand_text text,
    image_url text not null,
    website_url text,
    curation_status text not null default 'auto-suggested',
    last_updated timestamptz not null,
    raw_text text,
    scraped_at timestamptz not null default now(),
    analyzed_at timestamptz,
    created_at timestamptz not null default now(),

    -- Check constraint: valid curation_status values
    constraint chk_curation_status check (
        curation_status in ('curated', 'reviewed', 'auto-suggested', 'rejected')
    )
);

-- Migration: Add website_url and curation_status (for existing databases)
alter table if exists public.tools add column if not exists website_url text;
alter table if exists public.tools add column if not exists curation_status text not null default 'auto-suggested';
-- Note: The CHECK constraint may fail if existing rows have invalid values.
-- If needed, first update existing rows: UPDATE public.tools SET curation_status = 'auto-suggested' WHERE curation_status IS NULL;
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'chk_curation_status' 
    and conrelid = 'public.tools'::regclass
  ) then
    alter table public.tools add constraint chk_curation_status
      check (curation_status in ('curated', 'reviewed', 'auto-suggested', 'rejected'));
  end if;
end;
$$;
-- Do not remove NOT NULL from curation_status after data is populated without a default strategy.
-- Indexes
create index if not exists idx_tools_source_id on public.tools (source_id);
create index if not exists idx_tools_original_url on public.tools (original_url);
create index if not exists idx_tools_analyzed_at on public.tools (analyzed_at);
create index if not exists idx_tools_scraped_at on public.tools (scraped_at);
create index if not exists idx_tools_created_at on public.tools (created_at);

-- RLS
alter table public.tools enable row level security;

-- Anon can read tools that have been analyzed
drop policy if exists "tools_anon_select_analyzed" on public.tools;
create policy "tools_anon_select_analyzed"
    on public.tools
    for select
    to anon
    using (analyzed_at is not null);

-- Service role has full access
drop policy if exists "tools_service_role_all" on public.tools;
create policy "tools_service_role_all"
    on public.tools
    for all
    to service_role
    using (true)
    with check (true);

-- ============================================================================
-- TABLE: tool_analyses
-- ============================================================================
create table if not exists public.tool_analyses (
    id uuid primary key default gen_random_uuid(),
    tool_id uuid not null unique references public.tools(id) on delete cascade,
    summary text not null,
    adoption_score numeric not null check (adoption_score >= -1 and adoption_score <= 1),
    adoption_label text not null check (adoption_label in ('early-stage', 'growing', 'established')),
    tool_rating_label text not null check (tool_rating_label in ('beginner-friendly', 'balanced', 'power-user', 'mixed', 'unclear')),
    beginner_friendly_percentage int not null check (beginner_friendly_percentage >= 0 and beginner_friendly_percentage <= 100),
    balanced_percentage int not null check (balanced_percentage >= 0 and balanced_percentage <= 100),
    power_user_percentage int not null check (power_user_percentage >= 0 and power_user_percentage <= 100),
    complexity_score numeric not null,
    confidence numeric not null check (confidence >= 0 and confidence <= 1),
    main_purpose text not null,
    category text not null,
    target_users text not null,
    key_features text[] not null default '{}',
    pros text[] not null default '{}',
    cons text[] not null default '{}',
    pricing_model text not null check (pricing_model in ('free', 'freemium', 'paid', 'usage-based', 'enterprise', 'unclear')),
    integrations text[] not null default '{}',
    best_for text not null,
    marketing_buzzwords text[] not null default '{}',
    rating_notes text not null,
    disclaimer text not null,
    model text not null,
    created_at timestamptz not null default now(),

    -- Check constraint: percentages sum to 100
    constraint chk_percentages_sum_100 check (
        beginner_friendly_percentage + balanced_percentage + power_user_percentage = 100
    ),

    -- Check constraint: complexity_score = (power_user_percentage - beginner_friendly_percentage) / 100.0
    constraint chk_complexity_score check (
        complexity_score = (power_user_percentage - beginner_friendly_percentage) / 100.0
    )
);

-- Indexes
create index if not exists idx_tool_analyses_tool_id on public.tool_analyses (tool_id);
create index if not exists idx_tool_analyses_category on public.tool_analyses (category);
create index if not exists idx_tool_analyses_adoption_label on public.tool_analyses (adoption_label);
create index if not exists idx_tool_analyses_tool_rating_label on public.tool_analyses (tool_rating_label);

-- RLS
alter table public.tool_analyses enable row level security;

-- Anon can read analyses for analyzed tools (join with tools table)
drop policy if exists "tool_analyses_anon_select_analyzed" on public.tool_analyses;
create policy "tool_analyses_anon_select_analyzed"
    on public.tool_analyses
    for select
    to anon
    using (
        exists (
            select 1 from public.tools t
            where t.id = tool_analyses.tool_id
            and t.analyzed_at is not null
        )
    );

-- Service role has full access
drop policy if exists "tool_analyses_service_role_all" on public.tool_analyses;
create policy "tool_analyses_service_role_all"
    on public.tool_analyses
    for all
    to service_role
    using (true)
    with check (true);

-- ============================================================================
-- TABLE: logs
-- ============================================================================
create table if not exists public.logs (
    id uuid primary key default gen_random_uuid(),
    level text not null check (level in ('info', 'warn', 'error')),
    message text not null,
    metadata jsonb,
    created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_logs_created_at on public.logs (created_at desc);
create index if not exists idx_logs_level on public.logs (level);

-- RLS
alter table public.logs enable row level security;

-- Service role only - no anon access
drop policy if exists "logs_service_role_all" on public.logs;
create policy "logs_service_role_all"
    on public.logs
    for all
    to service_role
    using (true)
    with check (true);

-- ============================================================================
-- TABLE: oxylabs_schedules
-- ============================================================================
create table if not exists public.oxylabs_schedules (
    id uuid primary key default gen_random_uuid(),
    oxylabs_schedule_id text not null unique, -- LARGE INT as TEXT to avoid precision loss
    source_id uuid not null unique references public.tool_sources(id) on delete cascade,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_oxylabs_schedules_source_id on public.oxylabs_schedules (source_id);
create index if not exists idx_oxylabs_schedules_active on public.oxylabs_schedules (active);

-- RLS
alter table public.oxylabs_schedules enable row level security;

-- Service role only - no anon access
drop policy if exists "oxylabs_schedules_service_role_all" on public.oxylabs_schedules;
create policy "oxylabs_schedules_service_role_all"
    on public.oxylabs_schedules
    for all
    to service_role
    using (true)
    with check (true);

-- ============================================================================
-- TABLE: oxylabs_schedule_runs
-- ============================================================================
create table if not exists public.oxylabs_schedule_runs (
    id uuid primary key default gen_random_uuid(),
    schedule_id uuid not null references public.oxylabs_schedules(id) on delete cascade,
    oxylabs_run_id text not null, -- LARGE INT as TEXT to avoid precision loss
    status text not null check (status in ('pending', 'done', 'faulted')),
    started_at timestamptz,
    completed_at timestamptz,
    tools_found int not null default 0,
    tools_inserted int not null default 0,
    tools_rejected int not null default 0,
    error_message text,
    created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_oxylabs_schedule_runs_schedule_id on public.oxylabs_schedule_runs (schedule_id);
create index if not exists idx_oxylabs_schedule_runs_status on public.oxylabs_schedule_runs (status);
create index if not exists idx_oxylabs_schedule_runs_created_at on public.oxylabs_schedule_runs (created_at desc);

-- RLS
alter table public.oxylabs_schedule_runs enable row level security;

-- Service role only - no anon access
drop policy if exists "oxylabs_schedule_runs_service_role_all" on public.oxylabs_schedule_runs;
create policy "oxylabs_schedule_runs_service_role_all"
    on public.oxylabs_schedule_runs
    for all
    to service_role
    using (true)
    with check (true);

-- ============================================================================
-- GRANTS for Data API exposure (if using Data API)
-- ============================================================================
-- Grant usage on schema to anon and authenticated roles
grant usage on schema public to anon, authenticated, service_role;

-- Grant select on tables that anon should read
grant select on public.tool_sources to anon;
grant select on public.tools to anon;
grant select on public.tool_analyses to anon;

-- Grant all on tables for service_role
grant all on public.tool_sources to service_role;
grant all on public.tools to service_role;
grant all on public.tool_analyses to service_role;
grant all on public.logs to service_role;
grant all on public.oxylabs_schedules to service_role;
grant all on public.oxylabs_schedule_runs to service_role;

-- Grant usage on sequences
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- Trigger for oxylabs_schedules updated_at
drop trigger if exists update_oxylabs_schedules_updated_at on public.oxylabs_schedules;
create trigger update_oxylabs_schedules_updated_at
    before update on public.oxylabs_schedules
    for each row
    execute function public.update_updated_at_column();

-- ============================================================================
-- PGVECTOR
-- ============================================================================
create extension if not exists vector;

alter table public.tool_analyses add column if not exists embedding vector(1024);
create index if not exists idx_tool_analyses_embedding
  on public.tool_analyses
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ============================================================================
-- VECTOR SIMILARITY SEARCH FUNCTION
-- ============================================================================
create or replace function public.match_related_tools(
  query_embedding vector(1024),
  match_threshold float default 0.5,
  match_count int default 6
)
returns table (
  id uuid,
  tool_id uuid,
  tool_name text,
  tool_image_url text,
  tool_slug text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    ta.id,
    ta.tool_id,
    t.name as tool_name,
    t.image_url as tool_image_url,
    t.id::text as tool_slug,
    1 - (ta.embedding <=> query_embedding) as similarity
  from public.tool_analyses ta
  join public.tools t on t.id = ta.tool_id
  where ta.embedding is not null
    and 1 - (ta.embedding <=> query_embedding) > match_threshold
  order by ta.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Large integers (Oxylabs schedule_id, run_id) stored as TEXT to avoid precision loss
--    JavaScript Number.MAX_SAFE_INTEGER is 2^53-1, Oxylabs IDs can exceed this
--
-- 2. RLS policies use 'to anon' and 'to service_role' (not auth.role() which is deprecated)
--
-- 3. No SECURITY DEFINER functions in public schema
--
-- 4. Service role key NEVER exposed to browser (no NEXT_PUBLIC_ prefix)