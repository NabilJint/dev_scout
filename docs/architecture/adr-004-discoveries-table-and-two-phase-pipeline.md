# ADR-004: Two-Phase Pipeline with Discoveries Table

**Date**: 2026-07-22
**Status**: Proposed
**Author**: Software Architect

## Context

The current scraping pipeline follows a linear "scrape → extract → validate → insert" model where source page data is treated as tool data. This conflates:

- **Discovery** (finding a potential tool on a source) with
- **Enrichment** (resolving the tool's actual metadata)

The current pipeline also has no persistence between scrape runs — if a tool was discovered but lacked a logo or website URL on one run, that information is lost. Future runs will re-discover and re-process it.

## Decision

### Create a `discoveries` table

Introduce a lightweight staging table that persists discovery data between pipeline runs:

```sql
create table public.discoveries (
    id uuid primary key default gen_random_uuid(),
    source_id uuid not null references public.tool_sources(id),
    source_url text not null unique,
    external_url text,
    product_name text not null,
    popularity_score numeric,
    metadata jsonb,
    enrichment_status text not null default 'pending'
        check (enrichment_status in ('pending', 'enriched', 'failed')),
    discovered_at timestamptz not null default now()
);
```

### Restructure pipeline into two phases

**Phase 1 — Discovery** (runs on every scrape/schedule):
1. Scrape source homepage
2. Extract candidate links + metadata
3. Store each as a row in `discoveries` (`ON CONFLICT(source_url) DO NOTHING`)
4. Light processing only — no detail page scraping

**Phase 2 — Enrichment** (runs after discovery, can be separate trigger):
1. For each pending discovery, fetch the source detail page
2. Extract actual tool website URL, name, description, image
3. Resolve logo
4. Validate as a real developer tool
5. If passing, insert into `tools` with `curation_status = 'auto-suggested'`
6. If failing, store the rejection reason and set `enrichment_status = 'failed'`

### Deduplication across phases

- **Discoveries**: Unique on `source_url` (so re-scraping the same PH post is idempotent)
- **Tools**: Unique on `website_url` (so re-discovering Cursor from three sources still resolves to one tool row)
- **Mapping**: `tools.discovery_id` links back to the `discoveries` row that created it

## Consequences

**Positive**:
- Pipeline is idempotent — re-scraping doesn't duplicate work
- Failed enrichments are recorded and not retried blindly (can add retry logic later)
- Discoveries-only runs are fast (no detail page scraping)
- Future enrichment improvements automatically backfill pending discoveries
- Admin can see what was discovered vs what became a tool

**Negative**:
- Two-phase logic is more complex than linear pipeline
- Requires new table + migration
- Enrichment phase needs to be triggered (either chained after discovery or run separately)

**Neutral**:
- Existing scrape-to-insert pipeline can be maintained as a shortcut for curated tools
- Discoveries table provides an audit trail of what sources are yielding

## Alternatives Considered

1. **Keep single-phase but add `website_url`**: Doesn't solve the re-processing problem — each scrape re-scrapes the same detail pages
2. **No staging table, just improve inline extraction**: Doesn't persist discovery state between runs
3. **Use a queue (RabbitMQ/Redis)**: Over-engineered for current scale — a database table with a status column is sufficient
