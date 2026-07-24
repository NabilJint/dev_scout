# ADR-003: Add `website_url` and `curation_status` to tools table

**Date**: 2026-07-22
**Status**: Proposed
**Author**: Software Architect

## Context

The `tools.original_url` currently stores the discovery-platform URL (e.g., `producthunt.com/posts/cursor`) rather than the tool's actual website (`cursor.com`). This causes three problems:

1. **Broken deduplication** — The same tool discovered from different sources creates duplicate rows because `original_url` differs
2. **Poor UX** — Users visiting a tool detail page see the discovery source URL, not where they can actually use the tool
3. **No quality differentiation** — Seed tools (hand-curated with verified metadata) and auto-scraped tools are indistinguishable in the schema

## Decision

### Add `website_url` column

A nullable `website_url` column that stores the actual tool website (e.g., `https://cursor.com`). When not null, it becomes the primary deduplication key.

```sql
alter table public.tools add column if not exists website_url text;
create unique index if not exists idx_tools_website_url on public.tools (website_url)
    where website_url is not null;
```

### Add `curation_status` column

An enum-like text column with a check constraint:

```sql
alter table public.tools add column if not exists curation_status text
    not null default 'pending'
    check (curation_status in ('curated', 'auto-suggested', 'reviewed', 'rejected'));
```

Meanings:
- **curated** — Hand-picked, verified metadata. Highest trust. Always shown on homepage.
- **auto-suggested** — Found by automated scraping but not yet reviewed. Hidden from homepage.
- **reviewed** — An admin reviewed and approved an auto-suggested tool. Shown on homepage.
- **rejected** — An admin rejected the tool. Never shown.

## Consequences

**Positive**:
- Deduplication now works correctly — two discoveries of Cursor resolve to `cursor.com`
- UI can show the actual tool URL on detail pages instead of the PH/HN source URL
- Homepage quality is protected — scrapped tools are hidden until curated or reviewed
- Clear upgrade path from auto-suggested → reviewed for promising discoveries

**Negative**:
- Schema migration requires backfilling `website_url` for all existing tools
- Queries must now filter on `curation_status` to get displayable tools (simple WHERE clause)
- Admin UI needed to review auto-suggested tools (future work)

**Neutral**:
- Existing `original_url` remains as the discovery source URL — both have distinct purposes
- Existing `canonical_url` remains for resolving URL variants

## Alternatives Considered

1. **Replace `original_url` with `website_url`**: Breaking change; loses discovery source traceability
2. **Use `canonical_url` for this purpose**: `canonical_url` is meant for URL normalization (http vs https, trailing slashes), not for cross-source deduplication
3. **No change, just improve parser extraction**: Doesn't solve the deduplication or quality differentiation problems
