# Supabase Schema & Data Access Implementation

## Goal
Implement the complete Supabase database schema and data access layer for DevScout AI, including all 6 core tables, RLS policies, indexes, TypeScript types, and query functions.

## Assigned Specialist Agent(s)
Database Engineer (from AGENTS.md Section 0)

## Skills Read
- supabase (from .agents/skills/supabase/SKILL.md)
- supabase-postgres-best-practices (from .agents/skills/supabase-postgres-best-practices/SKILL.md)

## Existing Code Inspected
- lib/mock-data.ts - TypeScript interfaces for ToolSource, Tool, ToolAnalysis, ToolWithAnalysis
- lib/constants.ts - Category mappings
- package.json - Dependencies: @supabase/supabase-js, @supabase/ssr
- .env.local - Supabase URL, anon key, service role key

## Decisions or Assumptions
1. Use imperative migrations (hand-authored SQL) since no declarative schema exists
2. Large integers (Oxylabs schedule_id, run_id) stored as TEXT to avoid precision loss
3. Service role key used for server-side writes (scraping, analysis, scheduling)
4. Anon key used for client-side reads (UI display only)
5. RLS enabled on all tables in public schema
6. pgvector extension will be added later (Section 20) - embedding column added via ALTER
7. logs table structure per AGENTS.md Section 7 (minimal fields for pipeline logging)

## Files Likely to Change/Create
- supabase/schema.sql (NEW - main schema file)
- lib/supabase/types.ts (NEW - TypeScript types from schema)
- lib/supabase/client.ts (NEW - Supabase client helpers)
- lib/supabase/queries/tools.ts (NEW - tool queries)
- lib/supabase/queries/sources.ts (NEW - source queries)
- lib/supabase/queries/analyses.ts (NEW - analysis queries)
- lib/supabase/queries/logs.ts (NEW - log queries)
- lib/supabase/queries/schedules.ts (NEW - schedule queries)
- lib/supabase/queries/runs.ts (NEW - run queries)

## Implementation Requirements

### 1. supabase/schema.sql
Create all 6 tables with exact fields from AGENTS.md Section 7:

**tool_sources**
- id uuid pk default gen_random_uuid()
- name text not null
- listing_url text not null unique
- logo_url text nullable
- active boolean not null default true
- parser_strategy text nullable
- created_at timestamptz not null default now()

**tools**
- id uuid pk default gen_random_uuid()
- source_id uuid not null references tool_sources(id)
- original_url text not null unique
- canonical_url text not null
- name text not null
- brand_text text nullable
- image_url text not null
- last_updated timestamptz not null
- raw_text text nullable
- scraped_at timestamptz not null default now()
- analyzed_at timestamptz nullable
- created_at timestamptz not null default now()
- Index on source_id, original_url, analyzed_at

**tool_analyses**
- id uuid pk default gen_random_uuid()
- tool_id uuid not null unique references tools(id) on delete cascade
- summary text not null
- adoption_score numeric not null check between -1 and 1
- adoption_label text not null check in ('early-stage','growing','established')
- tool_rating_label text not null check in ('beginner-friendly','balanced','power-user','mixed','unclear')
- beginner_friendly_percentage int not null check between 0 and 100
- balanced_percentage int not null check between 0 and 100
- power_user_percentage int not null check between 0 and 100
- complexity_score numeric not null
- confidence numeric not null check between 0 and 1
- main_purpose text not null
- category text not null
- target_users text not null
- key_features text[] not null default '{}'
- pros text[] not null default '{}'
- cons text[] not null default '{}'
- pricing_model text not null check in ('free','freemium','paid','usage-based','enterprise','unclear')
- integrations text[] not null default '{}'
- best_for text not null
- marketing_buzzwords text[] not null default '{}'
- rating_notes text not null
- disclaimer text not null
- model text not null
- embedding vector(1536) nullable -- added later via ALTER after pgvector enabled
- created_at timestamptz not null default now()
- Check constraint: beginner_friendly_percentage + balanced_percentage + power_user_percentage = 100
- Check constraint: complexity_score = (power_user_percentage - beginner_friendly_percentage) / 100.0

**logs**
- id uuid pk default gen_random_uuid()
- level text not null check in ('info','warn','error')
- message text not null
- metadata jsonb nullable
- created_at timestamptz not null default now()
- Index on created_at

**oxylabs_schedules**
- id uuid pk default gen_random_uuid()
- oxylabs_schedule_id text not null unique -- LARGE INT as TEXT
- source_id uuid not null unique references tool_sources(id) on delete cascade
- active boolean not null default true
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

**oxylabs_schedule_runs**
- id uuid pk default gen_random_uuid()
- schedule_id uuid not null references oxylabs_schedules(id) on delete cascade
- oxylabs_run_id text not null -- LARGE INT as TEXT
- status text not null check in ('pending','done','faulted')
- started_at timestamptz nullable
- completed_at timestamptz nullable
- tools_found int not null default 0
- tools_inserted int not null default 0
- tools_rejected int not null default 0
- error_message text nullable
- created_at timestamptz not null default now()
- Index on schedule_id, status

### 2. RLS Policies
Enable RLS on ALL tables. Policies:
- tool_sources: anon can SELECT active sources; service_role full access
- tools: anon can SELECT tools with analyzed_at not null; service_role full access
- tool_analyses: anon can SELECT for analyzed tools; service_role full access
- logs: service_role full access only (no anon access)
- oxylabs_schedules: service_role full access only
- oxylabs_schedule_runs: service_role full access only

### 3. lib/supabase/types.ts
Generate TypeScript types matching the schema exactly. Use the interfaces from lib/mock-data.ts as reference.

### 4. lib/supabase/client.ts
Create two clients:
- createServerClient() - uses service role key for server-side writes
- createBrowserClient() - uses anon key for client-side reads
Follow @supabase/ssr patterns for Next.js

### 5. Query Functions
Create typed query functions in lib/supabase/queries/:
- tools.ts: getTools(), getToolById(), getToolsBySource(), insertTool(), updateToolAnalyzedAt(), getPendingAnalysisTools()
- sources.ts: getActiveSources(), getSourceById(), insertSource(), updateSource()
- analyses.ts: getAnalysisByToolId(), insertAnalysis(), updateAnalysis()
- logs.ts: insertLog(), getLogs()
- schedules.ts: getSchedules(), insertSchedule(), updateSchedule(), deactivateOrphanSchedules()
- runs.ts: insertRun(), updateRun(), getRunsBySchedule()

All queries must use service role client for writes, anon/client for reads.

## Security Requirements
- RLS enabled on all public schema tables
- Service role key NEVER exposed to browser (no NEXT_PUBLIC_)
- Anon key for client reads only
- Oxylabs large integers stored as TEXT
- No SECURITY DEFINER functions in public schema
- Follow AGENTS.md Section 21 security checklist

## Acceptance Criteria
1. All 6 tables created with correct columns, types, constraints
2. RLS enabled on all tables with appropriate policies
3. Indexes created for query performance (source_id, original_url, analyzed_at, schedule_id, status, created_at)
4. TypeScript types in lib/supabase/types.ts match schema
5. Query functions in lib/supabase/queries/ for all common operations
6. npm run typecheck passes with no errors
7. npm run lint passes with no errors
8. Schema applies successfully in Supabase Dashboard → SQL Editor

## Checks to Run
- npm run typecheck
- npm run lint
- (npm run build if routes/config changed)

## Exact Manual Test Steps
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste contents of supabase/schema.sql
3. Run the SQL - verify no errors
4. Go to Table Editor - verify all 6 tables exist with correct columns
5. Go to Authentication → Policies - verify RLS enabled on all tables
6. Run `npm run typecheck` in terminal - must pass
7. Run `npm run lint` in terminal - must pass
8. Verify TypeScript types are correctly generated