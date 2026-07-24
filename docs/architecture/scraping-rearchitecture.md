# DevScout AI: Scraping Pipeline Re-architecture

**Date**: 2026-07-22
**Author**: Software Architect
**Status**: Proposed (pending ADR)

---

## 1. Current Architecture Analysis

### 1.1 What's Actually Happening

The current pipeline follows a linear model:

```
Source Homepage HTML → Extract candidate links (source page URLs) → Scrape each candidate → Parse tool content from candidate HTML → Insert with candidate URL as original_url
```

**The root problem**: The pipeline treats discovery-source pages (Product Hunt posts, HN links, GitHub repos) as if they *are* the tools themselves. They're not — they're **references to** tools.

### 1.2 Specific Data Quality Issues

#### Issue A: URL Model

| Source | Current `original_url` | What it *should* be |
|---|---|---|
| Product Hunt | `producthunt.com/posts/cursor` | `cursor.com` |
| Hacker News | `some-external-site.com/page` | `some-external-site.com/page` (mostly OK) |
| GitHub Trending | `github.com/owner/repo` | `repos-website.com` (if it exists) |

The `original_url` field conflates two distinct concepts:
- The **discovery URL** (where we found the tool)
- The **tool's canonical website URL** (where users actually go to use it)

**Impact on deduplication**: If Cursor is discovered on PH and HN, it gets stored as two separate tools because the `original_url` differs. The `unique` constraint on `original_url` works against us here.

#### Issue B: Image/Logo Quality

Every parser uses `og:image` as the primary image source. On discovery platforms:
- **Product Hunt**: `og:image` = social preview screenshot of the product page, not brand logo
- **GitHub Trending**: `og:image` = GitHub's social preview (owner/repo card), not the tool's logo
- **Hacker News**: `og:image` = whatever the linked page has (may be nothing)

The seed tools use `cdn.simpleicons.org` which returns clean SVG brand logos. The scraped tools get whatever `og:image` happens to be on the page.

#### Issue C: What Passes as a "Tool"

The current validation rejects:
- Blog/article titles ("How to X", "Guide to Y", etc.)
- Consumer products (fashion, food, gaming, etc.)
- Generic titles (Blog, Careers, etc.)
- Pages without images or last-updated dates

**But it lets through**:
- GitHub repos that are libraries/frameworks/hobby projects (not tools)
- Academic papers hosted on personal sites
- Directory/category pages on SaaSHub
- Side projects that aren't real developer tools
- Corporate press releases repackaged as blog pages
- Pages with 900+ characters of boilerplate that barely pass the character check

The validation is format-based (does it have an image? enough text?) rather than **substance-based** (is this actually a developer tool?).

#### Issue D: Missing Enrichment Step

The pipeline never enriches a candidate after extracting its name. The Product Hunt parser *tries* to extract the `websiteUrl` from the detail page but appends it to `rawText` as a note — it's never used in the `original_url` or stored as a separate `website_url` field.

---

## 2. Recommended Approach: Option C (Hybrid)

I recommend **Option C — Curated-first with intelligent discovery enrichment**, for these reasons:

1. **The seed quality bar is the right bar**. The 12 seed tools (Cursor, Supabase, Clerk, Vercel, etc.) set the standard: real logos from `cdn.simpleicons.org`, real website URLs, proper descriptions, accurate categorization. Users judge the entire product by these. Any automated addition must meet this bar.

2. **Automated scraping is unreliable for metadata**. Even with better parsing, we cannot reliably extract:
   - A tool's real website URL from a PH/HN/GitHub source page
   - A tool's brand logo (as opposed to a screenshot or social preview)
   - An accurate category and description that matches the seed quality

3. **Discovery signals are valuable — but as signals, not data**. PH upvotes, HN points, GitHub stars tell us "this is popular." They don't tell us "this is what the tool actually is." We should use sources for discovery, then enrich.

### 2.1 The Three-Layer Model

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: CURATED                          │
│  50-100 hand-picked developer tools with verified metadata  │
│  - Real website URLs (checked manually)                     │
│  - Real logos (cdn.simpleicons.org or manual upload)        │
│  - Verified descriptions, categories                         │
│  - This is the DEFAULT browsing experience                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│               LAYER 2: DISCOVERY SIGNALS                     │
│  Sources (PH, HN, GitHub Trending) used to FIND tools       │
│  - Extract: tool NAME + source URL + popularity metrics     │
│  - NOT stored as tools — stored as discoveries              │
│  - Each discovery has: source + source_url + external_url   │
│    + name + popularity_score + discovered_at                │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              LAYER 3: ENRICHMENT PIPELINE                    │
│  Converts discoveries → candidate tools → curated additions │
│  Step 1: Extract tool name from discovery                   │
│  Step 2: Try to resolve tool website (search/check)         │
│  Step 3: Look up logo from cdn.simpleicons.org by name      │
│  Step 4: Apply strict quality gate                          │
│  Step 5: Flag for review (not auto-insert)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Specific Design Decisions

### 3.1 URL Model: Add `website_url`, Repurpose `original_url`

**Decision**: Add a new `website_url` column to the `tools` table. `original_url` becomes the **discovery URL** (where we found the tool). `website_url` is the **tool's actual website**.

**Schema change**:
```sql
alter table public.tools add column if not exists website_url text;
alter table public.tools add column if not exists curation_status text not null default 'pending'
    check (curation_status in ('curated', 'auto-suggested', 'reviewed', 'rejected'));

-- New uniqueness constraint: website_url (when not null)
-- This is the REAL deduplication key
create unique index if not exists idx_tools_website_url on public.tools (website_url)
    where website_url is not null;
```

**Deduplication logic changes**:
- Primary dedup: `website_url` (canonical website — two discoveries of Cursor resolve to `cursor.com`)
- Secondary dedup: `original_url` (prevent re-scraping the same PH post)
- When inserting scraped tools where `website_url` could not be resolved, the tool goes into `curation_status = 'auto-suggested'` and does NOT display on the homepage

**Impact on seed tools**: The 12 seed tools already have `original_url = actual_website_url` and `canonical_url = actual_website_url`. We backfill `website_url = original_url` for them and set `curation_status = 'curated'`.

### 3.2 Logo Source Strategy

**Decision**: Three-tier logo resolution:

1. **Tier 1 — cdn.simpleicons.org lookup** (server-side, after scraping):
   - Takes the tool name, normalizes it (lowercase, remove spaces/special chars)
   - Checks `https://cdn.simpleicons.org/{normalized-name}` 
   - SimpleIcons has 3,100+ icons including most major dev tools
   - The seed tools already use this

2. **Tier 2 — Known logo registry** (for tools not on SimpleIcons):
   - A small `logos.json` file in the codebase mapping tool names to logo URLs
   - Trigger.dev → `https://trigger.dev/assets/triggerdev-logo--light.svg`
   - Inngest → `https://www.inngest.com/logo-with-icon-white.svg`
   - This exists as a last resort for curated additions

3. **Tier 3 — Page extraction fallback**:
   - Try favicon from the tool's website
   - Try `og:image` from the tool's website (NOT the source page)
   - Accept only if it looks like a logo (square, SVG, or contains "logo" in filename)

**Logic**:
```
function resolveLogo(toolName: string, discoveredUrl?: string): Promise<string | null>
  // 1. Check simpleicons
  const simpleiconsUrl = `https://cdn.simpleicons.org/${normalizeName(toolName)}`;
  if (await urlExists(simpleiconsUrl)) return simpleiconsUrl;

  // 2. Check registry
  if (logoRegistry[toolName.toLowerCase()]) return logoRegistry[toolName.toLowerCase()];

  // 3. Try page favicon
  if (discoveredUrl) {
    const favicon = await extractFavicon(discoveredUrl);
    if (favicon) return favicon;
  }

  return null;
```

### 3.3 Tool vs Non-Tool: Stricter Criteria

**Decision**: Replace the current format-based validation with a **substance classifier** that asks: "Is this a **developer tool**?"

A developer tool is defined as:
> A product (SaaS, open-source project, CLI, framework, library, platform, or service) that helps developers build, deploy, monitor, or ship software. Its primary users are software developers and engineers.

**Specifically, a tool must satisfy ALL of**:
1. **Primary audience is developers** — its documentation, marketing, and API are for developers
2. **Solves a development problem** — coding, testing, deployment, monitoring, collaboration, authentication, databases, APIs, etc.
3. **Has a discernible product** — a website, a GitHub repo with releases, a CLI you can install, a SaaS you can sign up for
4. **Is not purely educational** — "Learn to code" platforms, tutorials, books, courses ARE NOT tools (unless they have a tool component)

**New rejection categories** (to be added to validation):
- `academic_paper` — research papers, theses, preprints
- `hobby_project` — repos with < 50 stars, no releases, no website, personal projects
- `not_a_dev_tool` — consumer apps, design tools for non-devs, no-code platforms targeting business users
- `clone_template` — "build your own X" or "clone of Y" tutorials
- `package_only` — npm/gem/pip package with no standalone utility (libraries vs tools)
- `learning_resource` — courses, books, tutorials, "learn to code" platforms
- `data_only` — datasets, API wrappers, configs, dotfiles

Note: The strictest gate here is simple — if a scraped tool cannot resolve a real `website_url` and a real logo, it goes into `curation_status = 'auto-suggested'` and is hidden from the homepage until reviewed.

### 3.4 Pipeline Redesign

**Decision**: Restructure the scraping pipeline into two separate phases.

#### Phase 1: Discovery (lightweight, automated)

```
For each source:
  1. Scrape homepage
  2. Extract candidate links + metadata (title, source URL, popularity)
  3. For each candidate:
     a. Determine actual tool URL (parser extracts this from the detail page)
     b. Store in new `discoveries` table
```

New table `discoveries`:
```sql
create table public.discoveries (
    id uuid primary key default gen_random_uuid(),
    source_id uuid not null references public.tool_sources(id),
    source_url text not null,           -- e.g., producthunt.com/posts/tool-name
    external_url text,                   -- actual tool URL if extractable
    product_name text not null,          -- extracted name
    popularity_score numeric,            -- normalized score across sources
    metadata jsonb,                      -- source-specific (upvotes, stars, etc.)
    discovered_at timestamptz not null default now()
);

create unique index idx_discoveries_source_url on public.discoveries (source_url);
create index idx_discoveries_product_name on public.discoveries (product_name);
```

#### Phase 2: Enrichment (heavier, triggers tool creation)

```
For each unprocessed discovery:
  1. Resolve tool website URL (from discovery, or extract from source page)
  2. Resolve logo (simpleicons → registry → favicon)
  3. Fetch tool's actual website content for description
  4. Validate (is it a dev tool?)
  5. If passes ALL checks + has logo:
     → Insert into tools with curation_status = 'auto-suggested'
     → (Optional: auto-promote to 'reviewed' if confidence > threshold)
  6. If fails any check:
     → Store rejection reason
     → Do NOT insert into tools table
```

#### Phase 3: Review (human-in-the-loop)

```
Admin dashboard:
  - Shows all 'auto-suggested' tools
  - One-click approve (→ curation_status = 'reviewed', displays on homepage)
  - One-click reject (→ curation_status = 'rejected', never shown)
  - Edit metadata (website_url, image_url, name)
```

### 3.5 SimpleIcons Lookup as Enrichment Step

**Decision**: Post-scrape enrichment via SimpleIcons should be added immediately. Here's how it works:

1. After extracting a tool name from a source page, normalize it:
   ```typescript
   function normalizeForSimpleIcons(name: string): string {
     return name
       .toLowerCase()
       .replace(/[^a-z0-9]/g, '')  // remove non-alphanumeric
       .replace(/^[0-9]+/, '');     // remove leading digits
   }
   ```

2. Check if SimpleIcons has it:
   ```
   GET https://cdn.simpleicons.org/{normalized-name}
   ```
   Returns the SVG if the icon exists. SimpleIcons returns a valid SVG for ~3100 brands.

3. If the logo exists, use it directly. If not, fall through to other methods.

4. **Do NOT use SimpleIcons as a quality gate** — some real developer tools (Trigger.dev, Inngest) are not on SimpleIcons. Missing a SimpleIcons entry is not a rejection reason.

---

## 4. Schema Changes Summary

### New `discoveries` table
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

### Changes to `tools` table
```sql
alter table public.tools add column if not exists website_url text;
alter table public.tools add column if not exists curation_status text not null default 'pending'
    check (curation_status in ('curated', 'auto-suggested', 'reviewed', 'rejected'));
alter table public.tools add column if not exists discovery_id uuid references public.discoveries(id);

create unique index if not exists idx_tools_website_url on public.tools (website_url)
    where website_url is not null;
```

### Backfill for seed tools
```sql
update public.tools
set website_url = original_url,
    curation_status = 'curated'
where name in ('Cursor', 'Supabase', 'Clerk', 'Vercel', 'Resend', 'Prisma',
               'Stripe', 'PlanetScale', 'Railway', 'Coolify', 'Trigger.dev', 'Inngest');
```

---

## 5. Changes to `lib/scrape/types.ts`

```typescript
export interface ScrapedTool {
  title: string;
  description: string;
  imageUrl: string;
  lastUpdated: string;
  rawText: string;
  // NEW FIELDS
  websiteUrl: string | null;       // actual tool URL extracted from source page
  sourceUrl: string;               // the source page URL (e.g., PH post)
  popularityScore?: number;         // normalized popularity
}

export interface DiscoveryResult {
  productName: string;
  sourceUrl: string;
  externalUrl: string | null;      // actual tool website, if extractable
  popularityScore?: number;
  metadata?: Record<string, unknown>;
}
```

---

## 6. Changes to Parsers

Each parser must now also extract the **actual tool website URL** from the source detail page:

### Product Hunt parser change
The parser already extracts `websiteUrl` from `a[data-test="product-url"]` but only appends it to `rawText`. Instead, return it as part of `ScrapedTool.websiteUrl`.

```typescript
extractToolContent(html: string): ScrapedTool | null {
  // ... existing title, description, image extraction ...

  // Extract actual website URL (already exists but unused)
  const websiteUrl =
    $('a[data-test="product-url"]').attr('href') ||
    $('a[class*="website"]').attr('href') || '';

  return {
    title,
    description,
    imageUrl,
    lastUpdated,
    rawText,
    websiteUrl: websiteUrl || null,   // NEW: passed explicitly
    sourceUrl: url,                   // NEW: the PH post URL
  };
}
```

### GitHub Trending parser change
GitHub repos often have a homepage link in their README/About section. Extract it:
```typescript
const websiteUrl =
  $('a[href]:not([href*="github.com"])').filter((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    return text.includes('website') || text.includes('homepage') || text.includes('site');
  }).first().attr('href') || '';
```

### Hacker News — the candidate URL IS the external URL
HN links are submitted by users and directly point to the tool's website. The `candidate.url` IS the `websiteUrl`. No change needed here — just pass it through.

---

## 7. Pipeline Flow Diagram (ASCII)

```
                    ┌─────────────────┐
                    │   Tool Sources   │
                    │  (Supabase DB)   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  1. Scrape      │
                    │   Homepage      │
                    │  (via Oxylabs)  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  2. Extract     │
                    │   Candidates    │
                    │  (parsers)      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  3. Filter &    │
                    │   Dedupe        │
                    │  (source URLs)  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────────────┐
                    │  4a. Scrape Detail      │
                    │    (source page)        │
                    └────────┬────────────────┘
                             │
                             ▼
                    ┌─────────────────────────┐
                    │  4b. Extract Tool       │
                    │    Metadata             │
                    │  - website_url (NEW!)   │
                    │  - name                 │
                    │  - image                │
                    │  - description          │
                    └────────┬────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                              │
              ▼                              ▼
    ┌──────────────────┐          ┌──────────────────────┐
    │ website_url      │          │ No website_url       │
    │ resolved?        │          │ (can't find tool URL)│
    └────────┬─────────┘          └──────────┬───────────┘
             │                               │
             ▼                               ▼
    ┌──────────────────┐          ┌──────────────────────┐
    │ 5. Enrich        │          │ Store as discovery   │
    │ - Logo lookup    │          │ (not a tool)         │
    │ - Website fetch  │          │ enrichment_status =  │
    │ - Validate       │          │ 'pending'             │
    └────────┬─────────┘          └──────────────────────┘
             │
             ▼
    ┌──────────────────┐
    │ 6. Quality Gate  │
    │ - Real dev tool? │
    │ - Has logo?      │
    │ - Has website?   │
    └────────┬─────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌──────────┐  ┌──────────────┐
│ Insert   │  │ Store as     │
│ as       │  │ rejected     │
│ auto-    │  │ discovery    │
│ suggested│  │              │
└──────────┘  └──────────────┘
```

---

## 8. Implementation Phasing

### Phase 1 (Immediate — next sprint)
1. **Add `website_url` to schema** and backfill seed tools
2. **Add `curation_status` to schema** and set seed tools to 'curated'
3. **Update Product Hunt parser** to return `websiteUrl` explicitly (it already extracts it)
4. **Add SimpleIcons lookup utility** — `lib/enrichment/simpleicons.ts`
5. **Update pipeline** to pass `websiteUrl` through to insert params
6. **Update validation** to require `website_url` for auto-promotion to 'reviewed'
7. **Quality gate**: Reject tools missing website_url or logo → store as 'auto-suggested'

### Phase 2 (Next sprint)
1. **Create `discoveries` table**
2. **Refactor pipeline** into two phases (discovery → enrichment)
3. **Build enrichment logic** for website URL resolution
4. **Build logo resolution** (SimpleIcons → registry → favicon)
5. **Build admin review endpoint** (GET auto-suggested, PATCH to approve/reject)
6. **Update homepage query** to only show `curation_status IN ('curated', 'reviewed')`

### Phase 3 (Future)
1. **Admin dashboard UI** for reviewing suggested tools
2. **Automatic promotion** of high-confidence tools (e.g., website validated, logo found, description has sufficient quality)
3. **Duplicate detection** across sources (same tool discovered from PH + HN)

---

## 9. Acceptance Criteria for Phase 1

| Criteria | Current | Target |
|---|---|---|
| Seed tools have `website_url` | N/A (no field) | All 12 seed tools |
| Seed tools are `curation_status = 'curated'` | N/A (no field) | All 12 seed tools |
| Scraped PH tools have `website_url` set | `websiteUrl` extracted but stored in `rawText` only | Stored in `website_url` column |
| Tools without `website_url` are `auto-suggested` | They pass through as valid tools | They get flagged and hidden |
| SimpleIcons logo lookup works | No such system | Can resolve ~60% of known dev tools |
| Homepage only shows curated + reviewed | Shows everything with `analyzed_at` not null | Shows curated + reviewed only |

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| SimpleIcons returns SVG for names that happen to match but aren't the right tool | Wrong logo | Only use SimpleIcons when the tool's website URL is confirmed; add manual override in registry |
| Some real tools have no resolvable website URL (HN link to npm page) | Good tools stuck as 'auto-suggested' | Manually add to curated list; accept this as intentional quality gate |
| Breaking change requires data migration | Migration risk | Run ALTER TABLE first, backfill in a separate step, update queries before deploying |
| Team prefers existing scraping approach | Adoption resistance | Show concrete quality comparison — seed tools vs scraped tools side by side |

---

## 11. ADR-to-File Mapping

| Decision | File |
|---|---|
| Add `website_url` column | `docs/architecture/adr-003-website-url.md` |
| Add `curation_status` column | `docs/architecture/adr-004-curation-status.md` |
| Two-phase pipeline | `docs/architecture/adr-005-discovery-enrichment-pipeline.md` |
| SimpleIcons lookup | `docs/architecture/adr-006-simpleicons-enrichment.md` |
| Substance-based validation | `docs/architecture/adr-007-substance-validation.md` |
