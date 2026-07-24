# Wire Up Supabase Database to Frontend Pages

## Goal
Connect the existing Supabase data access layer (`lib/supabase/queries/`) to the frontend pages so the app displays live Supabase data instead of mock data. Add graceful fallback to mock data when the database is empty (pre-seeding).

## Assigned Specialist Agent(s)
- **Frontend Engineer** — pages and component type imports (from AGENTS.md Section 0)

## Skills Read
- **supabase** (`.agents/skills/supabase/SKILL.md`) — query function signatures, server/client boundaries, service role vs anon key patterns
- **vercel-react-best-practices** (`.claude/skills/vercel-react-best-practices/SKILL.md`) — data fetching patterns in server components, async component patterns

## Existing Code Inspected
- `app/page.tsx` — Home page, async server component that currently imports from `@/lib/supabase/queries/tools`
- `app/tools/[id]/page.tsx` — Tool details page, async server component that currently imports from `@/lib/supabase/queries/tools`
- `lib/mock-data.ts` — Mock data functions and types (`getTools`, `getToolById`, `getRelatedTools`, `getCategories`, `toolSourceCounts`, `ToolWithAnalysis`)
- `lib/supabase/queries/tools.ts` — Real Supabase query functions (`getTools`, `getToolById`, `getPendingAnalysisTools`, `getToolCount`)
- `lib/supabase/types.ts` — TypeScript types (`ToolWithAnalysis`, `Tool`, `ToolAnalysis`, `ToolSource`)
- `lib/constants.ts` — Static category lists, color/gradient/icon mappings
- All component files under `components/tool-details/` and `components/tool-card.tsx`

## Current State Assessment

### ✅ Already Wired (partial — no changes needed)
- `app/page.tsx` — imports `getTools` from `@/lib/supabase/queries/tools`, imports `ToolWithAnalysis` from `@/lib/supabase/types`, has mock data fallback, uses static categories
- `app/tools/[id]/page.tsx` — imports `getToolById` and `getTools` from `@/lib/supabase/queries/tools`, imports `ToolWithAnalysis` from `@/lib/supabase/types`, has mock data fallback for missing tools and related tools

### ❌ Still Needs Work
- **Component type imports** — All 13 component files still import `ToolWithAnalysis` type from `@/lib/mock-data` instead of `@/lib/supabase/types`. The shapes are structurally identical, so TypeScript doesn't error, but this is conceptually incorrect and creates a hidden dependency on mock-data from components.
- **`toolSourceCounts` dependency** — `components/tool-card.tsx` and `components/tool-details/ai-score-card.tsx` import `toolSourceCounts` from `@/lib/mock-data` for displaying source count. This is mock-only data that won't reflect real Supabase data.

## Decisions/Assumptions

1. **`getTools()` returns `ToolWithAnalysis[]`** — same shape as mock data. Compatible with `ToolGrid`, `ToolCard`, and all detail sub-components.
2. **`getToolById()` returns `ToolWithAnalysis | null`** — same as mock data's `getToolById`. Compatible with all detail components.
3. **Categories come from `lib/constants.ts` (static list)** — not from database. The **filter pill categories** are `['All', 'AI Tools', 'Developer Tools', 'Backend', 'Frontend', 'Database', 'DevOps', 'Productivity', 'Security', 'Cloud']`. Tool badge categories are the specific ones from analysis data (`'AI Coding'`, `'Authentication'`, `'Backend'`, etc.). These are two different things, and both are already correctly defined.
4. **Related tools use category-based filtering** until pgvector is enabled (AGENTS.md Section 20). Query `getTools()` filtered by `tool_analyses.category`, exclude current tool, limit 5.
5. **Mock data fallback** — keep mock-data imports as dynamic `import()` fallbacks when Supabase returns empty results. This is essential for the dev flow before seeding runs.
6. **`ToolSource.subtitle` is not in Supabase schema** — the `subtitle` field exists on `mock-data.ts`'s `ToolAnalysis` but NOT on `lib/supabase/types.ts`'s `ToolAnalysis`. Check whether any component accesses `tool.tool_analyses.subtitle` and handle accordingly.
7. **`toolSourceCounts` stays as mock for now** — since modifying components is out of scope, the component imports of `toolSourceCounts` from mock-data will remain. These are cosmetic (show "X sources" on card footer / AI score card). This is acceptable as a visual placeholder until the data pipeline populates real counts.

## Files Likely to Change

Primary (Frontend Engineer's lane):
- `app/page.tsx` — verify Supabase wiring is correct, verify mock data fallback handles all edge cases
- `app/tools/[id]/page.tsx` — verify Supabase wiring, verify related tools query and fallback

Secondary (optional — see What NOT to Change below):
- Component `.tsx` files — **only** update the import line for `ToolWithAnalysis` from `@/lib/mock-data` → `@/lib/supabase/types`. Do NOT change any other code in these files.

## Implementation Requirements

### 1. Verify `app/page.tsx` Wiring

The page should already have this structure. Verify it matches exactly:

```tsx
// app/page.tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { getTools } from '@/lib/supabase/queries/tools'
import type { ToolWithAnalysis } from '@/lib/supabase/types'
import { CategoryFilter } from '@/components/category-filter'
import { ToolGrid } from '@/components/tool-grid'
import { EmptyState } from '@/components/empty-state'

interface HomePageProps {
  searchParams: Promise<{ category?: string }>
}

const categories = ['All', 'AI Tools', 'Developer Tools', 'Backend', 'Frontend', 'Database', 'DevOps', 'Productivity', 'Security', 'Cloud']

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams
  const category = params.category || 'All'

  // Try Supabase first, fall back to mock data if empty (DB not seeded yet)
  let tools: ToolWithAnalysis[] = await getTools({
    analyzedOnly: true,
    ...(category !== 'All' ? { category } : {}),
    limit: 50,
  }) as unknown as ToolWithAnalysis[]

  if (tools.length === 0) {
    const { getTools: getMockTools } = await import('@/lib/mock-data')
    tools = getMockTools(category === 'All' ? undefined : category) as unknown as ToolWithAnalysis[]
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Category Filter */}
      <div className="border-b border-[#1f2937] bg-[#111827] py-3">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6 lg:px-8">
          <Suspense fallback={<div className="h-9" />}>
            <CategoryFilter categories={categories} activeCategory={category} />
          </Suspense>
        </div>
      </div>

      {/* Main Content */}
      <section className="flex-1 py-6">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-[#f9fafb]">
              {category === 'All' ? 'Top Developer Tools' : category}
            </h1>
            <Link
              href="/tools"
              className="text-sm font-medium text-[#6366f1] hover:text-[#818cf8]"
            >
              View All Tools &rarr;
            </Link>
          </div>

          {tools.length > 0 ? (
            <ToolGrid tools={tools} />
          ) : (
            <EmptyState />
          )}
        </div>
      </section>
    </div>
  )
}
```

Key things to verify:

**a) Import check** — must import from `@/lib/supabase/queries/tools`, not `@/lib/mock-data`:

```tsx
import { getTools } from '@/lib/supabase/queries/tools'        // ✅ CORRECT
import type { ToolWithAnalysis } from '@/lib/supabase/types'   // ✅ CORRECT
```

**b) Category filtering** — `getTools()` filters `category` in-memory (since it's on the joined `tool_analyses` table). The `category` param is passed only when not `'All'`. The static filter pill categories (`'All'`, `'AI Tools'`, etc.) are NOT tool analysis categories — they map to tool analysis categories in the mock data via `categoryFilterMap`. For the real query, the category value filters against `tool_analyses.category` directly. This means:
- When user selects `'Database'`, it passes `category: 'Database'` to `getTools()`, which filters for tools whose `tool_analyses.category === 'Database'`
- This is DIFFERENT from mock data's `categoryFilterMap` which maps filter pills to a different set of category names

**⚠️ CRITICAL — Category filtering mismatch between mock data and Supabase:**

Mock data's `categoryFilterMap` maps filter pills like `'AI Tools'` → `['AI Coding']`, `'Developer Tools'` → `['Email', 'ORM']`, etc. But the Supabase `getTools()` filters directly on `tool_analyses.category`. This means when a user clicks `'AI Tools'`, Supabase will look for tools with `tool_analyses.category === 'AI Tools'` which won't match anything (tools have `'AI Coding'` as their category).

**Fix:** When the category is a filter-pill category (one of the 10 in the static list), resolve it to the actual analysis categories before passing to `getTools()`. Use this mapping:

```tsx
// Filter pill → analysis category mapping (mirrors mock-data's categoryFilterMap)
const pillToAnalysisCategories: Record<string, string[] | undefined> = {
  'All': undefined,                    // no filter
  'AI Tools': ['AI Coding'],
  'Developer Tools': ['Email', 'ORM'],
  'Backend': ['Backend'],
  'Frontend': ['Deployment'],
  'Database': ['Database'],
  'DevOps': ['DevOps'],
  'Productivity': ['Monitoring'],
  'Security': ['Authentication'],
  'Cloud': ['Cloud'],
}
```

Since `getTools()` only accepts a single `category` string, use the first entry from the resolved list when there's one, or leave it undefined for `'All'`:

```tsx
const resolvedCategories = category !== 'All' ? pillToAnalysisCategories[category] : undefined
let tools: ToolWithAnalysis[] = await getTools({
  analyzedOnly: true,
  ...(resolvedCategories ? { category: resolvedCategories[0] } : {}),
  limit: 50,
}) as unknown as ToolWithAnalysis[]
```

For categories that map to multiple analysis categories (e.g., `'Developer Tools'` → `['Email', 'ORM']`), the in-memory filter in `getTools()` only handles a single category string. To handle multi-category filter pills, add a `categories` array parameter to the query, or apply the second filter in JavaScript after fetching all analyzed tools.

**Recommended approach:** Keep it simple — since `getTools()` already does in-memory filtering by category, fetch all analyzed tools (no category filter), then apply the pill category mapping in JavaScript:

```tsx
const pillToAnalysisCategories: Record<string, string[] | undefined> = {
  'All': undefined,
  'AI Tools': ['AI Coding'],
  'Developer Tools': ['Email', 'ORM'],
  'Backend': ['Backend'],
  'Frontend': ['Deployment'],
  'Database': ['Database'],
  'DevOps': ['DevOps'],
  'Productivity': ['Monitoring'],
  'Security': ['Authentication'],
  'Cloud': ['Cloud'],
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams
  const category = params.category || 'All'

  // Try Supabase first, fall back to mock data if empty
  let tools: ToolWithAnalysis[] = await getTools({
    analyzedOnly: true,
    limit: 50,
  }) as unknown as ToolWithAnalysis[]

  // Apply category filter in-memory (supports multi-category filter pills)
  if (category !== 'All' && tools.length > 0) {
    const allowedCategories = pillToAnalysisCategories[category]
    if (allowedCategories) {
      tools = tools.filter(t => allowedCategories.includes(t.tool_analyses?.category ?? ''))
    }
  }

  if (tools.length === 0) {
    const { getTools: getMockTools } = await import('@/lib/mock-data')
    tools = getMockTools(category === 'All' ? undefined : category) as unknown as ToolWithAnalysis[]
  }
  // ... rest of component
}
```

**c) Mock fallback** — uses dynamic `import('@/lib/mock-data')` only when Supabase returns empty. This preserves the mock data bundle as async chunk that's never loaded in production once data exists.

**d) Null vs empty** — `getTools()` returns `[]` (empty array) when no tools match. The `tools.length === 0` check handles empty DB. The `EmptyState` component renders when no tools are found at all.

### 2. Verify `app/tools/[id]/page.tsx` Wiring

The page should already have this structure. Verify it matches:

```tsx
// app/tools/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getToolById, getTools } from '@/lib/supabase/queries/tools'
import type { ToolWithAnalysis } from '@/lib/supabase/types'
// ... all component imports ...

export default async function ToolDetailsPage({ params }: ToolDetailsPageProps) {
  const { id } = await params

  // Try Supabase first, fall back to mock data if tool not found
  let tool: ToolWithAnalysis | null = await getToolById(id) as unknown as ToolWithAnalysis | null

  if (!tool) {
    const { getToolById: getMockToolById } = await import('@/lib/mock-data')
    tool = getMockToolById(id) as unknown as ToolWithAnalysis | null
  }

  if (!tool) {
    notFound()
  }

  // Fetch related tools by category (until pgvector is enabled)
  let relatedTools: ToolWithAnalysis[] = []
  if (tool.tool_analyses?.category) {
    relatedTools = await getTools({
      category: tool.tool_analyses.category,
      analyzedOnly: true,
      limit: 5,
    }) as unknown as ToolWithAnalysis[]
    relatedTools = relatedTools.filter(t => t.id !== id)
  }

  // Fall back to mock data if not enough related tools found
  if (relatedTools.length < 3) {
    const { getRelatedTools: getMockRelated } = await import('@/lib/mock-data')
    relatedTools = getMockRelated(id, tool.tool_analyses?.category) as unknown as ToolWithAnalysis[]
  }

  // ... rest of component (render)
}
```

Key things to verify:

**a) Import check** — must import from `@/lib/supabase/queries/tools`, not `@/lib/mock-data`:

```tsx
import { getToolById, getTools } from '@/lib/supabase/queries/tools'  // ✅ CORRECT
import type { ToolWithAnalysis } from '@/lib/supabase/types'          // ✅ CORRECT
```

**b) Tool not found** — `getToolById()` returns `null` when tool doesn't exist. The `notFound()` call shows the `not-found.tsx` page.

**c) Related tools** — queried by `tool_analyses.category` from Supabase. If fewer than 3 results, falls back to mock data's `getRelatedTools()`. The `RelatedTools` component already handles empty arrays (returns `null`).

**d) The `subtitle` field** — `ToolAnalysis` in `lib/supabase/types.ts` includes `subtitle: string`, which matches the mock-data interface. Verify this field is present in the database query results. If the database doesn't have `subtitle` populated yet, the component will display `undefined` or empty. This is acceptable as data gets populated after scraping/analysis.

### 3. Update Component Type Imports (Secondary — Only If Needed)

The components currently import `ToolWithAnalysis` from `@/lib/mock-data`. Since the type shapes are structurally identical, this doesn't cause compilation errors. But it creates a conceptual dependency on mock-data from production components.

**If the manager approves** updating these, change the import line in all 13 component files from:

```tsx
import type { ToolWithAnalysis } from '@/lib/mock-data'
```

to:

```tsx
import type { ToolWithAnalysis } from '@/lib/supabase/types'
```

Files to update:
- `components/tool-card.tsx` (also imports `toolSourceCounts` from mock-data — leave that import)
- `components/tool-grid.tsx`
- `components/tool-details/hero-section.tsx`
- `components/tool-details/ai-score-card.tsx` (also imports `toolSourceCounts` — leave that import)
- `components/tool-details/metadata-row.tsx`
- `components/tool-details/ai-summary.tsx`
- `components/tool-details/key-features.tsx`
- `components/tool-details/pros-cons.tsx`
- `components/tool-details/best-for.tsx`
- `components/tool-details/integrations.tsx`
- `components/tool-details/related-tools.tsx`
- `components/tool-details/tool-screenshot.tsx`
- `components/tool-details/tool-information.tsx`

**Keep** the `toolSourceCounts` import in `tool-card.tsx` and `ai-score-card.tsx` — those are runtime values, not types, and need a separate solution.

## What NOT to Change

- ❌ Do NOT modify `lib/mock-data.ts` — keep it as the fallback data source
- ❌ Do NOT modify `lib/supabase/queries/tools.ts` or any other query file
- ❌ Do NOT modify `lib/supabase/types.ts`
- ❌ Do NOT modify `lib/constants.ts`
- ❌ Do NOT add new dependencies or clients
- ❌ Do NOT change component rendering logic, layouts, or styles
- ❌ Do NOT remove the `toolSourceCounts` import from components — that requires a separate change to compute real source counts

## Security Requirements

- All query functions use `createServerReadOnlyClient()` internally (anon key for reads on the server)
- No sensitive data exposed to browser code
- Dynamic `import()` of mock-data is server-side only — never exposes mock data structure to client
- No new environment variables needed

## Acceptance Criteria

1. ✅ Home page loads tools from Supabase when database has analyzed tools
2. ✅ Home page falls back to mock data when database is empty (pre-seeding)
3. ✅ Tool details page loads tool from Supabase when available
4. ✅ Tool details page falls back to mock data when tool not found in DB
5. ✅ Not-found page (`app/tools/[id]/not-found.tsx`) renders for invalid/missing IDs
6. ✅ Related tools show from Supabase (by category) with mock data fallback
7. ✅ Category filter pills correctly filter tools (including multi-category pills like `'AI Tools'`, `'Developer Tools'`)
8. ✅ All UI components render correctly — no layout shifts or missing data
9. ✅ `npm run typecheck` passes
10. ✅ `npm run lint` passes

## Edge Cases

| Case | Expected Behavior |
|------|------------------|
| Database completely empty (no `tool_sources`, `tools`, or `tool_analyses`) | Mock data shows in full |
| Database has tools but none analyzed | `analyzedOnly: true` returns empty → mock data fallback |
| Database has tools but category filter matches none | In-memory filter returns `[]` → shows `EmptyState` |
| Tool ID valid in Supabase but analysis not yet run | `tool_analyses` is `null` in returned data → components handle gracefully (show "No analysis available") |
| Tool ID exists in mock data but not in Supabase | `getToolById()` returns `null` → mock data `getToolById()` provides the tool |
| Tool ID doesn't exist anywhere | `notFound()` called → `app/tools/[id]/not-found.tsx` renders |
| Category filter pill maps to multiple analysis categories (e.g., `'Developer Tools'` → `['Email', 'ORM']`) | In-memory filter includes both categories |
| `subtitle` is empty/null in Supabase data | Components display `tool_sources.name` as fallback (already implemented) |
| `toolSourceCounts` returns `undefined` for tools from Supabase | Components use `|| 1` or `|| 18` fallback (already implemented) |

## Checks to Run

- `npm run typecheck` — must pass with no errors
- `npm run lint` — must pass with no errors
- `npm run build` — must pass (since page files are changing, routes could be affected)

## Manual Test Steps

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Home page with empty DB:**
   - Visit `http://localhost:3000`
   - Should show mock data tools (Cursor, Supabase, Clerk, etc.)
   - Verify all 12 tools render in the grid
   - Verify category filter pills work

3. **Home page category filter test:**
   - Click each category filter pill
   - Verify only matching tools show
   - Test multi-category pills like `'AI Tools'` (should show Cursor, Clerk)
   - Test `'Developer Tools'` (should show Resend, Prisma)

4. **Tool details page:**
   - Click a tool card (e.g., Cursor)
   - Should navigate to `/tools/1`
   - Verify all sections render: hero, AI score card, screenshot, metadata, AI summary, key features, pros/cons, best for, integrations, related tools
   - Verify sidebar renders: score breakdown, AI confidence, source breakdown, quick actions, tool information

5. **Tool details navigation:**
   - Click a related tool card
   - Should navigate to that tool's details page
   - Verify back navigation works (breadcrumb or browser back)

6. **404 page:**
   - Visit `http://localhost:3000/tools/nonexistent-id-123`
   - Should see not-found page (not a blank page or error)

7. **Mixed DB state (if seeded data available):**
   - After seeding, tools should appear from Supabase
   - Mock data fallback should NOT show when DB has data

## Handoff

1. **Frontend Engineer** — implement the verified wiring and category filter fix
2. **Code Reviewer** — review the diff for correctness, especially the category filter mapping and mock fallback logic
3. **QA Engineer** — run `typecheck`, `lint`, `build` checks, then manual test steps above
4. **Documentation Memory Agent** — log outcome to `docs/agents/memory-log.md`
5. **CEO Assistant** — compile results into final report

