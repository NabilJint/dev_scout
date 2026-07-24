# Real Tool Logos & Seed Data Update

## Goal

Replace all placeholder `image_url` values in the seed data with real, publicly accessible logo URLs for all 12 tools, refactor the `ToolCard` component to display those logos from the database (instead of relying solely on hardcoded SVGs), integrate the existing shadcn/ui `Card` component into the tool card layout, and add a "Code reuse preflight" rule to `AGENTS.md`.

## Assigned Specialist Agent(s)

- **Database Engineer** — Find real logo URLs, update `supabase/seed-data.sql` image_url values.
- **Frontend Engineer** — Refactor `BannerLogo` to use `image_url`; integrate `Card`, `CardHeader`, `CardContent`, `CardFooter` from `@/components/ui/card` into `tool-card.tsx`.
- **Technical Writer** — Add "Code reuse preflight" rule to `AGENTS.md` in two places.
- **Code Reviewer** — Review the diff from Database Engineer and Frontend Engineer before merge. Read-only — flags issues rather than editing directly.

## Skills Read

- `supabase` — Seed script idempotency patterns (ON CONFLICT, WHERE NOT EXISTS), data migration best practices.
- `brand` — Logo usage guidelines, brand asset sourcing conventions.
- `frontend-design` — Production-grade UI patterns, component styling, responsive image handling.
- `ui-styling` — Tailwind CSS utility patterns (object-contain, aspect-ratio, responsive sizing).

## Existing Code Inspected

- `supabase/seed-data.sql` — 12 tools with `placehold.co` image URLs. Note: Clerk's placeholder URL has a typo (`400x400xa` instead of `400x400`) on line 85.
- `components/tool-card.tsx` — `BannerLogo` function (lines 42–174) uses hardcoded SVGs in a `toolSvgs` map with a letter-based fallback. It does **not** check `tool.image_url` at all. The `ToolCard` component (lines 188–256) wraps content in a raw `<article>` with manual border/background classes instead of using the `Card` component.
- `components/ui/card.tsx` — Existing shadcn/ui Card component (103 lines) exporting `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardAction`, `CardDescription`, `CardContent`. Currently not imported or used anywhere in `app/`, `components/`, or `lib/` — this prompt changes that.
- `lib/supabase/types.ts` — `Tool` interface has `image_url: string` (line 24) and `brand_text: string | null` (line 23). `ToolWithAnalysis` extends `Tool` (line 98), so `tool.image_url` is available.
- `components/tool-details/hero-section.tsx` — Already uses `tool.image_url` (line 19) with `next/image` and `unoptimized`, so it will automatically benefit from real logo URLs in the seed data.
- `lib/constants.ts` — Tool gradient overrides and category colors used by ToolCard.
- `app/tools/[id]/page.tsx` — Details page server component passing `tool` to `HeroSection`.
- `AGENTS.md` — Manager's checklist at end of Section 21 (lines 943–956) currently has 12 items. No "Code reuse preflight" section exists yet.
- `lib/utils.ts` — `cn()` utility available for className merging, used by the Card component.

## Decisions or Assumptions

1. Logo URLs must be **publicly accessible** (no auth, no CORS restrictions). Use official CDN-hosted brand assets, SVG repositories, or well-known logo CDNs (e.g., `cdn.simpleicons.org`, `logo.clearbit.com`, `imgix` from official sources).
2. The `image_url` column becomes the **source of truth** for tool logos. Hardcoded SVGs in `BannerLogo` are preserved as a secondary fallback.
3. The Clerk placeholder URL typo (`400x400xa`) is fixed as part of the seed update.
4. No new columns or schema changes are needed — `image_url` already exists.
5. The existing `components/ui/card.tsx` is **kept** and used by this prompt. Do not delete it.
6. The hero-section does not need modification — it already renders `tool.image_url` with `unoptimized` next/image, which works with external URLs.
7. `AGENTS.md` needs two additions: a new "Code reuse preflight" section and item 13 in the Manager's checklist.

## Files Likely to Change

| File | Action | Specialist |
|------|--------|------------|
| `supabase/seed-data.sql` | **Modify** — Replace 12 `image_url` placeholder values with real URLs | Database Engineer |
| `components/tool-card.tsx` | **Modify** — Refactor `BannerLogo` to use `image_url` prop; restructure to use `Card`, `CardHeader`, `CardContent`, `CardFooter` | Frontend Engineer |
| `AGENTS.md` | **Modify** — Add "Code reuse preflight" section and item 13 to Manager's checklist | Technical Writer |
| _(all changed files)_ | **Review** — Examine all diffs from Database Engineer and Frontend Engineer | Code Reviewer |

## Implementation Requirements

### For Database Engineer

#### 1. Read current seed-data.sql
Read and understand the current `supabase/seed-data.sql` file, especially the `tools` INSERT block (lines 39–216). Note the `where not exists` deduplication on each tool entry.

#### 2. Assign real logo URLs for each of the 12 tools
Find a real, publicly accessible logo URL for each tool. Preferred sources (in order):

- **Official brand asset CDN** — Many companies host their logos on a CDN (e.g., supabase.com, clerk.com).
- **cdn.simpleicons.org** — `https://cdn.simpleicons.org/{toolname}` (e.g., `https://cdn.simpleicons.org/supabase`). Note tool names may differ from display names (e.g., `planetscale`, `prisma`, `stripe`, `vercel`).
- **logo.clearbit.com** — `https://logo.clearbit.com/{domain}` (e.g., `https://logo.clearbit.com/cursor.com`). May not work for all domains.
- **Official GitHub repository** — Many open-source tools have SVG logos in their GitHub repos.
- **Official brand press kits** — When available, use the URL from the company's official press/brand kit page.

For each tool, verify the URL returns a valid image by fetching it or checking documentation.

#### 3. Logo URL candidates to use

Use these well-known, publicly accessible logo sources. Verify each before committing:

| Tool | Domain | Suggested URL Source |
|------|--------|---------------------|
| Cursor | cursor.com | `https://cdn.simpleicons.org/cursor` or official brand assets |
| Supabase | supabase.com | `https://cdn.simpleicons.org/supabase/3ecf8e` or `https://supabase.com/dashboard/img/supabase-logo.svg` |
| Clerk | clerk.com | `https://cdn.simpleicons.org/clerk` or `https://clerk.com/logo.svg` |
| Vercel | vercel.com | `https://cdn.simpleicons.org/vercel/000000/ffffff` (dark/light) or `https://vercel.com/api/www/sections/home/logo.svg` |
| Resend | resend.com | `https://cdn.simpleicons.org/resend` or `https://resend.com/logo.svg` |
| Prisma | prisma.io | `https://cdn.simpleicons.org/prisma` or `https://prisma.io/icons/icon-512.png` |
| Stripe | stripe.com | `https://cdn.simpleicons.org/stripe` or `https://stripe.com/img/logo.svg` |
| PlanetScale | planetscale.com | `https://cdn.simpleicons.org/planetscale` or `https://planetscale.com/logo.svg` |
| Railway | railway.app | `https://cdn.simpleicons.org/railway` or `https://railway.app/logo.svg` |
| Coolify | coolify.io | `https://cdn.simpleicons.org/coolify` or GitHub repo logo |
| Trigger.dev | trigger.dev | `https://cdn.simpleicons.org/triggerdev` or `https://trigger.dev/logo.svg` |
| Inngest | inngest.com | `https://cdn.simpleicons.org/inngest` or GitHub repo logo |

**Important:** cdn.simpleicons.org returns SVGs and is the most reliable option. However, test each URL in a browser to confirm it returns a valid image. If simpleicons doesn't have a specific tool, use `logo.clearbit.com/{domain}` or another public source.

**For the most reliable set, search for each tool's official brand assets page** (e.g., "supabase brand assets", "stripe logo SVG") to find the canonical URL.

#### 4. Update each image_url in seed-data.sql

For each of the 12 tools in `supabase/seed-data.sql`, replace the placeholder `image_url` value (e.g., `'https://placehold.co/400x400?text=Cursor'`) with the real URL.

The image_url line for each tool (lines 57, 71, 85, 99, 113, 127, 141, 155, 169, 183, 197, 211) should be updated individually.

Example change for Cursor (line 57):
```sql
-- Before:
'https://placehold.co/400x400?text=Cursor',
-- After:
'https://cdn.simpleicons.org/cursor',   -- verified: returns cursor SVG logo
```

**Fix the Clerk typo** on line 85 — `'https://placehold.co/400x400xa?text=Clerk'` should become a real URL (the `xa` was a typo).

#### 5. Add a comment marking the source of each logo URL

After each updated `image_url` line, add an inline SQL comment indicating where the URL came from. Example:

```sql
        'https://cdn.simpleicons.org/cursor',   -- source: cdn.simpleicons.org (valid SVG)
```

#### 6. Maintain idempotency

Do not change the `where not exists (select 1 from public.tools where original_url = ...)` guards on each tool entry. The seed script must remain safe to re-run.

Do not change the overall `ON CONFLICT` handling.

#### 7. Run and verify

After updating, run the updated seed script against Supabase (via Dashboard → SQL Editor or `supabase db query`). Then run:
```sql
SELECT id, name, image_url FROM public.tools ORDER BY name;
```
Verify all 12 rows show real URLs (not `placehold.co`). Open a few URLs in a browser to confirm they load.

### For Frontend Engineer

#### 1. Refactor `BannerLogo` to use `image_url`

Modify the `BannerLogo` function signature to accept an optional `imageUrl` prop:

```tsx
function BannerLogo({ name, brandText, imageUrl }: { name: string; brandText?: string | null; imageUrl?: string | null }) {
```

**Logic priority (first match wins):**

1. **If `imageUrl` is truthy and non-empty** — Render an `<img>` tag with the URL.
   - Use a standard `<img>` element (not `next/image`) to avoid needing to configure remote image domains.
   - Style: `className="h-24 w-24 object-contain"`
   - Wrap in a container div with `className="flex items-center justify-center drop-shadow-lg"`
   - Add `alt` text: `` `${name} logo` ``
   - Add `crossOrigin="anonymous"` and `referrerPolicy="no-referrer"` for external URLs.

2. **If `imageUrl` is null/empty** — Fall through to the existing SVG logic (`toolSvgs` map + brand text block).

3. **If no SVG exists for the tool name** — Fall through to the existing letter-based fallback (lines 156–173).

The existing code paths (lines 127–173) should remain unchanged as fallbacks.

#### 2. Update `BannerLogo` call site in `ToolCard`

In the `ToolCard` component, update the `BannerLogo` call on line 220 to pass `imageUrl`:

```tsx
<BannerLogo name={tool.name} brandText={tool.brand_text} imageUrl={tool.image_url} />
```

#### 3. Styling for the image fallback

The `<img>` tag should visually match the existing SVG/letter area:
- Container: `className="flex items-center justify-center drop-shadow-lg"`
- Image: `className="h-24 w-24 object-contain"` (96px × 96px, maintains aspect ratio)
- The gradient banner container is 140px tall, so a 96px logo with auto-centering looks appropriate.

#### 4. Handle edge cases

- **`image_url` is a URL but doesn't load** — The browser will show a broken image. This is acceptable since seed data will have working URLs. No need for a complex `onError` fallback (but it's a nice-to-have if straightforward).
- **`image_url` is the empty string** — Treat same as null: fall through to SVG/letter.
- **`image_url` is a placeholder URL (e.g., `placehold.co`)** — This shouldn't happen after the seed update, but if it does, the URL will load and render the image. The refactored code doesn't need to special-case placeholders.

#### 5. Integrate Card component from shadcn/ui into ToolCard

Do **not** delete `components/ui/card.tsx`. Instead, import and use it.

Currently `ToolCard` wraps content in a raw `<article>` with manual border/background classes. Replace this with the `Card` component and its subcomponents:

1. **Import** `Card`, `CardHeader`, `CardContent`, `CardFooter` from `@/components/ui/card`:

```tsx
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
```

2. **Restructure** the layout:

```tsx
// Before (line 198):
<article className="group flex flex-col rounded-xl border border-[#1f2937] bg-[#111827] transition-all duration-200 hover:border-[#374151] hover:shadow-lg">

// After:
<Card className="group flex flex-col rounded-xl border border-[#1f2937] bg-[#111827] transition-all duration-200 hover:border-[#374151] hover:shadow-lg overflow-hidden">
```

Replace the gradient banner area:
```tsx
{/* Before */}
<div className="relative h-[140px] w-full overflow-hidden rounded-t-xl" style={{ background: gradient }}>

{/* After — CardHeader serves as the header container */}
<CardHeader className="relative h-[140px] w-full overflow-hidden !p-0" style={{ background: gradient }}>
```

Replace the content area (tool name, subtitle, description, badges):
```tsx
{/* Before */}
<div className="flex flex-1 flex-col p-4">

{/* After */}
<CardContent className="flex flex-1 flex-col p-4">
```

Replace the footer area:
```tsx
{/* Before */}
<div className="mt-auto flex items-center justify-between border-t border-[#1f2937] pt-2.5">

{/* After */}
<CardFooter className="mt-auto flex items-center justify-between border-t border-[#1f2937] p-4 pt-2.5">
```

3. **Remove the closing tags** accordingly — `</CardContent>` instead of `</div>`, `</CardFooter>` instead of `</div>`, `</CardHeader>` instead of `</div>`, `</Card>` instead of `</article>`.

4. **Match existing visual styling** — Use `className` overrides on Card subcomponents to preserve the dark theme:
   - Card border color: `border-[#1f2937]`
   - Card background: `bg-[#111827]`
   - Card hover state: `hover:border-[#374151] hover:shadow-lg`
   - Card overflow: `overflow-hidden` (prevents gradient from bleeding corners)
   - CardHeader padding: `!p-0` (override default padding since the header is a 140px gradient area)
   - CardFooter padding: `p-4 pt-2.5` (top border with padding)

5. **Keep the `<Link>` wrapper** around the Card — the Card becomes the clickable article replacement inside the link.

#### 6. Verify TypeScript and lint pass

- `npm run typecheck` — Must pass with no errors.
- `npm run lint` — Must pass with no errors.

### For Technical Writer

Add a "Code reuse preflight" rule to `AGENTS.md` in two places:

#### 1. New "Code reuse preflight" section

Insert a new section after Section 21 (before the "---" separator at line 958). The content:

```markdown
## Code reuse preflight

Before any specialist writes new code, they MUST check `components/` for existing
components, and `lib/` for existing utility functions/constants/types, before
creating new ones. Duplicating existing code wastes time, increases bundle size,
and fragments the design system. When in doubt, ask the team or search the
codebase first.
```

Place this **after** the "Supabase joined table filter gotcha" section (line 941) and **before** the "When in doubt, the Manager's checklist is:" section (line 943). The insertion point for the new section heading, blank line, and content is between lines 941 and 943.

#### 2. Add item 13 to the Manager's checklist

At the end of the Manager's checklist in Section 21 (after line 956: `"12. CEO Assistant compiles and delivers the final report."`), add:

```markdown
13. Before coding: check existing components (`components/`) and utilities
    (`lib/`) — reuse, don't reinvent.
```

The resulting checklist should have 13 numbered items, with item 13 preceding the `---` separator that starts Section 22.

### Code Review Process

- **Code Reviewer** must review all diffs from **Database Engineer** and **Frontend Engineer** before they are considered done.
- **Read-only:** flag blocking issues, do not edit directly.
- If blocking issues are found, hand back to the implementing specialist with clear notes.

## Security Requirements

- No secrets needed. All image URLs are public.
- The `image_url` column is stored in Supabase and served through the API — no user-submitted URLs are involved.
- Use standard `<img>` (not `next/image`) for the ToolCard banner to avoid needing to configure `next.config.js` `remotePatterns`. (The hero-section already uses `next/image` with `unoptimized`, which bypasses domain checking.)
- Image URLs from `cdn.simpleicons.org` and similar CDNs have no tracking or security concerns.

## Acceptance Criteria

1. All 12 tools in `supabase/seed-data.sql` have non-placeholder, publicly accessible `image_url` values.
2. The Clerk placeholder typo (`400x400xa`) is fixed.
3. Running the updated seed script inserts/updates tools with correct logo URLs.
4. `SELECT id, name, image_url FROM public.tools ORDER BY name;` returns 12 rows with real URLs.
5. Each logo URL loads correctly in a browser.
6. `ToolCard` renders the real logo image from `image_url` on the gradient banner (not a placeholder or letter).
7. If `image_url` is missing/nulled, the card falls back to SVG gracefully.
8. If neither `image_url` nor SVG exists, the card falls back to the letter-based display.
9. **Card component from shadcn/ui is used in ToolCard** — `Card`, `CardHeader`, `CardContent`, `CardFooter` are imported from `@/components/ui/card` and wrap the tool card content. The raw `<article>` with manual border classes is replaced.
10. `components/ui/card.tsx` still exists (not deleted) and is now actively imported by `tool-card.tsx`.
11. The hero-section on the tool details page automatically shows the real logo (no changes needed — it already uses `tool.image_url`).
12. **`AGENTS.md` contains the code reuse preflight rule in two places** — a new "Code reuse preflight" section between the Supabase gotcha and the Manager's checklist, and item 13 added to the Manager's checklist.
13. `npm run typecheck` passes with zero errors.
14. `npm run lint` passes with zero errors.
15. All diffs reviewed by **Code Reviewer** with no blocking issues flagged.

## Checks to Run

- `npm run typecheck` — TypeScript compilation check.
- `npm run lint` — ESLint check.
- `rg "from.*@/components/ui/card" --include="*.tsx" --include="*.ts"` — Verify the card component is now imported by `components/tool-card.tsx` (return 1+ results, not zero).
- Browser check: Open each image URL to confirm it loads.

## Exact Manual Test Steps Expected After Implementation

1. **Run the updated seed script** via Supabase Dashboard → SQL Editor (paste the full `supabase/seed-data.sql` content and execute).
2. **Verify seed data:**
   ```sql
   SELECT id, name, image_url FROM public.tools ORDER BY name;
   ```
   — All 12 rows show real URLs (not `placehold.co`).
3. **Verify URLs load:** Open 3–4 image URLs in a browser tab. Each should display the tool's logo.
4. **Start the dev server:**
   ```bash
   npm run dev
   ```
5. **Navigate to the home page** (`http://localhost:3000`). Verify each tool card shows the **real logo image** on the gradient banner (not a placeholder or letter).
6. **Inspect a tool card:** Right-click the card area → Inspect. Verify:
   - The top-level element is a `<div>` with card-related class names from shadcn/ui (e.g., `data-slot="card"`, `rounded-xl`, `bg-card`), **not** a raw `<article>` with manual border classes.
   - The gradient banner area uses `<div data-slot="card-header">`.
   - The content area uses `<div data-slot="card-content">`.
   - The footer area uses `<div data-slot="card-footer">`.
   - The logo image is an `<img>` element with `src` pointing to the real URL.
7. **Click a tool card** to navigate to its details page (`/tools/{id}`). Verify the hero section also shows the real logo (it uses `tool.image_url` already — should work automatically).
8. **TypeScript check:**
   ```bash
   npm run typecheck
   ```
9. **Lint check:**
   ```bash
   npm run lint
   ```
10. **Verify card component is imported (not deleted):**
    ```bash
    rg "from.*@/components/ui/card" --include="*.tsx" --include="*.ts"
    ```
    Should return results showing the import in `components/tool-card.tsx`.

## Implementation Order

1. **Database Engineer** first: Update `supabase/seed-data.sql` with real URLs and comment sources. Run seed against Supabase. Verify.
2. **Frontend Engineer** second: Modify `components/tool-card.tsx` — refactor `BannerLogo`, integrate Card components. Run typecheck and lint.
3. **Technical Writer** third: Update `AGENTS.md` — add Code reuse preflight section and checklist item 13.
4. **Code Reviewer** fourth: Review all diffs. Hand back if blocking issues.
5. **QA Engineer** fifth: Run all checks and report.
6. **Documentation Memory Agent** sixth: Log outcomes.
7. **CEO Assistant** seventh: Compile final report.

## Handoff

- **Database Engineer** hands off to **Frontend Engineer** after seed data is verified.
- **Frontend Engineer** hands off to **Technical Writer** after tool-card changes are verified (typecheck + lint pass).
- **Technical Writer** hands off to **Code Reviewer** after AGENTS.md is updated.
- **Code Reviewer** hands off to **QA Engineer** after review passes.
- **QA Engineer** hands off to **Documentation Memory Agent** after all checks pass.
- **Documentation Memory Agent** hands off to **CEO Assistant** for the final report.

## Version Notes

- **Prompt file:** `prompts/logos-and-seed-data.md`
- **Prompt Engineer:** DevScout AI Prompt Engineer
- **Date:** 2026-07-21
- **Changes from v1:** Replaced "delete card.tsx" with "integrate Card into ToolCard"; added Technical Writer for AGENTS.md code reuse preflight rule; updated files, criteria, test steps, and checks.
