# Home Page Pixel-Perfect Implementation Prompt

## Goal

Reimplement the DevScout AI home page to match the UI reference at `ui_ref/home_page.png` pixel-perfectly. Every visual element — top bar, header, category pills, tool cards, footer — must match the reference image exactly in color, spacing, typography, gradients, and layout. Data comes from `lib/mock-data.ts` (already populated with 12 tools).

## Assigned Specialist Agent(s)

- **Frontend Engineer** — Primary implementer. Rewrites all page components to match the pixel-perfect reference.

## Skills Read

- `frontend-design` — Production-grade frontend interfaces, dark theme patterns, responsive layouts
- `ui-styling` — Tailwind CSS utilities, shadcn/ui component patterns, CSS variables
- `shadcn` — shadcn/ui component usage and customization

## Existing Code Inspected

- `app/globals.css` — Complete design token system with Tailwind v4 `@theme` blocks, all colors/typography/spacing defined
- `app/layout.tsx` — Root layout with Inter font, Header/Footer included
- `app/page.tsx` — Current home page (needs restructuring for top bar + hero removal)
- `components/header.tsx` — Current header (needs top bar addition + icon/logo updates)
- `components/footer.tsx` — Current footer (needs social icons, legal section, copyright reformatting)
- `components/tool-card.tsx` — Current tool card (needs gradient banner, restructured layout)
- `components/category-filter.tsx` — Current category filter (needs icons per category)
- `components/empty-state.tsx` — Empty state (no changes needed)
- `components/tool-grid.tsx` — Tool grid (no changes needed)
- `lib/mock-data.ts` — 12 sample tools with full analysis data
- `package.json` — Next.js 16, React 19, Tailwind v4, shadcn/ui installed
- `ui_ref/home_page.png` — The pixel-perfect reference image

## Decisions and Assumptions

1. **Existing shadcn/ui components are reused** — Button, Badge, Card, Input already installed. No new shadcn components needed.
2. **Mock data remains unchanged** — The 12 tools in `lib/mock-data.ts` stay as-is.
3. **Category-to-gradient mapping is hardcoded** — Each category has a specific gradient for its card banner area. This mapping is defined as a constant in `tool-card.tsx`.
4. **Category-to-icon mapping is hardcoded** — Each category pill has a small SVG icon. This mapping is defined as a constant in `category-filter.tsx`.
5. **Top bar is added above the header** — A thin bar with date, "Set Location", and "International Edition" sits above the main header.
6. **Hero section is removed** — The current "Top Developer Tools" hero section is replaced by the category pills directly below the header.
7. **Card layout is restructured** — Cards now have a colored gradient banner at top, tool logo centered in banner, category badge in top-left, info icon in top-right, then name/subtitle/description/rating bars below.
8. **Rating bar labels change** — "Beginner" → "Excellent", "Balanced" → "Average", "Power User" → "Poor" per the reference.
9. **Footer gets social icons, legal links in bottom bar, and copyright reformatted** — "© 2025 DevScout AI. All rights reserved." on left, "Made with ♥ for developers" on right, same line.
10. **Dark theme only** — No light mode.

## Files Likely to Change

| File | Action | Description |
|------|--------|-------------|
| `components/header.tsx` | **Rewrite** | Add top bar with date/location/edition; update logo to green circle with `</>` icon; update subscribe button to purple gradient with star icon |
| `components/tool-card.tsx` | **Rewrite** | Add gradient banner area; restructure layout; update rating bar labels; add category-to-gradient mapping |
| `components/category-filter.tsx` | **Rewrite** | Add SVG icons per category; update active pill styling to gradient background |
| `components/footer.tsx` | **Rewrite** | Add social icons row; add Legal section heading; reformat bottom bar with copyright + "Made with ♥" on same line |
| `app/page.tsx` | **Update** | Remove hero section; render category pills directly below header; keep tool grid |
| `app/layout.tsx` | **No change** | Header/Footer already included |

## Implementation Requirements

### 1. Top Bar (above header)

Add a thin top bar above the main header in `components/header.tsx`.

**Specifications:**
- Height: 32px (`h-8`)
- Background: `#0a0f16` (very dark, slightly different from page background)
- Border bottom: `1px solid #1f2937`
- Content: horizontally justified, centered vertically
- Left side: Date display — formatted as "Monday, June 2, 2025" (use `new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })`)
- Right side: Two items with gap-4
  - "Set Location" link with a small location pin icon (12x12 SVG, currentColor)
  - "International Edition" with a globe icon (12x12 SVG, currentColor), styled as a button/link

**Typography:**
- Font size: 12px (`text-xs`)
- Font weight: 400 (regular)
- Color: `#6b7280` (`text-text-muted`)

**Implementation:**
```tsx
function TopBar() {
  const today = new Date()
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="flex h-8 items-center justify-between border-b border-border-subtle bg-[#0a0f16] px-6">
      <span className="text-xs text-text-muted">{dateString}</span>
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Set Location
        </button>
        <button className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          International Edition
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
    </div>
  )
}
```

Then render `<TopBar />` before the existing `<header>` element inside the Header component.

### 2. Header (updated)

**Logo update:**
- Replace the purple "DS" square with a green circle containing a `</>` code icon
- Green circle: `bg-emerald-500` (`#10b981`), 32x32px, `rounded-full`
- Icon: white `</>` text inside, `text-sm font-bold`
- "DevScout AI" text: 16px, bold, white
- "Developer Tools Discovery Platform" subtitle: 12px, `#9ca3af`

**Navigation:**
- Items: Home, Categories, Collections, Resources, For You
- Home is active: `text-white font-medium`
- Others: `text-[#9ca3af] font-medium`
- "For You" has a purple "New" badge: `bg-[#7c3aed] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full`
- Hover state: `hover:text-white` for all nav items

**Subscribe button:**
- Background: purple-to-blue gradient `bg-gradient-to-r from-[#7c3aed] to-[#3b82f6]`
- Star icon before text: 14x14 SVG star, white
- Text: "Subscribe", 14px, font-medium, white
- Padding: `px-4 py-2`
- Border radius: `rounded-lg` (8px)

**Login button:**
- Background: transparent
- Border: `1px solid #374151`
- Text: "Login", 14px, `#9ca3af`
- Hover: border `#6b7280`, text white
- Padding: `px-4 py-2`
- Border radius: `rounded-lg` (8px)

**Header dimensions:**
- Height: 64px (`h-16`)
- Background: `#080d14` with 80% opacity + backdrop blur
- Border bottom: `1px solid #1f2937`

### 3. Category Filter Pills

Replace the current Badge-based pills with styled buttons that have icons and gradient active state.

**Specifications:**
- Horizontal scrollable row with `overflow-x-auto`
- Gap between pills: 8px (`gap-2`)
- Pill height: 36px (`h-9`)
- Pill padding: `px-3 py-1.5`
- Pill border radius: `rounded-full` (9999px)
- Pill font: 13px (`text-[13px]`), font-medium

**Inactive state:**
- Background: `#111827`
- Border: `1px solid #1f2937`
- Text: `#9ca3af`
- Icon color: `#6b7280`
- Hover: border `#374151`, text white

**Active state ("All" by default):**
- Background: gradient `bg-gradient-to-r from-[#7c3aed] to-[#3b82f6]`
- Border: none
- Text: white
- Icon color: white

**Category-to-icon mapping (each icon is 14x14 SVG, stroke-width 2):**

| Category | Icon Description | SVG |
|----------|-----------------|-----|
| All | Grid/apps icon | `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>` |
| AI Tools | Sparkle/star icon | `<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>` |
| Developer Tools | Code icon | `<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>` |
| Backend | Server icon | `<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>` |
| Frontend | Layout/icon icon | `<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>` |
| Database | Database icon | `<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>` |
| DevOps | Git branch icon | `<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>` |
| Productivity | Zap icon | `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>` |
| Security | Shield icon | `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>` |
| Cloud | Cloud icon | `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>` |

**Implementation:**
```tsx
const categoryIcons: Record<string, string> = {
  'All': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  'AI Tools': '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  // ... etc for each category
}

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const iconPaths = categoryIcons[name]
  if (!iconPaths) return null
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <g dangerouslySetInnerHTML={{ __html: iconPaths }} />
    </svg>
  )
}
```

### 4. Tool Card (complete rewrite)

The card has a fundamentally different layout from the current implementation.

**Card container:**
- Background: `#111827`
- Border: `1px solid #1f2937`
- Border radius: `12px` (`rounded-xl`)
- Overflow: hidden
- Hover: border `#374151`, subtle shadow increase
- Transition: all 200ms ease

**Gradient banner area (top portion):**
- Height: 120px (`h-[120px]`)
- Full width of card
- Each category has a specific gradient:

| Category | Gradient |
|----------|----------|
| AI Tools | `linear-gradient(135deg, #7c3aed, #a855f7)` (purple) |
| Backend | `linear-gradient(135deg, #059669, #34d399)` (green/teal) |
| Authentication | `linear-gradient(135deg, #2563eb, #60a5fa)` (blue) |
| Deployment | `linear-gradient(135deg, #0d9488, #5eead4)` (teal) |
| Email | `linear-gradient(135deg, #16a34a, #4ade80)` (green) |
| Database | `linear-gradient(135deg, #0284c7, #38bdf8)` (blue/teal) |
| Monitoring | `linear-gradient(135deg, #15803d, #4ade80)` (green) |
| ORM | `linear-gradient(135deg, #1d4ed8, #60a5fa)` (blue) |
| DevOps | `linear-gradient(135deg, #1e40af, #60a5fa)` (blue) |
| Cloud | `linear-gradient(135deg, #d97706, #fbbf24)` (orange/yellow) |
| Frontend | `linear-gradient(135deg, #7c3aed, #c084fc)` (purple) |
| Productivity | `linear-gradient(135deg, #ca8a04, #facc15)` (yellow) |
| Security | `linear-gradient(135deg, #dc2626, #f87171)` (red) |

**Category badge (top-left of banner):**
- Position: absolute, top-left of banner, `top-3 left-3`
- Background: matches category color (same as gradient start color) at 80% opacity
- Text: white, 11px, font-medium
- Padding: `px-2 py-0.5`
- Border radius: `rounded-md` (6px)

**Info icon (top-right of banner):**
- Position: absolute, top-right of banner, `top-3 right-3`
- Size: 20x20 circle
- Background: rgba(0,0,0,0.3)
- Border: `1px solid rgba(255,255,255,0.2)`
- Icon: white "i" letter, 12px, font-semibold
- Border radius: `rounded-full`

**Tool logo (centered in banner):**
- Position: centered horizontally and vertically in the banner
- Size: 64x64px
- Background: white (for contrast against gradient)
- Border radius: `rounded-xl` (12px for logo container), or circular `rounded-full` for circular logos
- Object-fit: contain
- Box shadow: `0 4px 12px rgba(0,0,0,0.15)`

**Below banner (content area):**
- Padding: `p-4`

**Tool name:**
- Font size: 16px (`text-base`)
- Font weight: 600 (semibold)
- Color: `#f9fafb` (`text-text-primary`)
- Margin-bottom: 2px

**Subtitle (company name):**
- Font size: 12px (`text-xs`)
- Color: `#6b7280` (`text-text-muted`)
- Margin-bottom: 8px

**Description:**
- Font size: 14px (`text-sm`)
- Color: `#9ca3af` (`text-text-secondary`)
- Line height: 1.5
- Line clamp: 2 lines max
- Margin-bottom: 12px

**Rating bars section:**
- Margin-bottom: 12px
- Three rows, each with: label, bar, percentage

**Each rating row:**
- Layout: flex row, items-center, gap-2
- Label: 12px, `#9ca3af`, width 64px (fixed)
- Bar container: flex-1, height 6px (`h-1.5`), background `#1f2937`, border-radius `rounded-full`
- Bar fill: height 100%, border-radius `rounded-full`
- Percentage: 12px, `#6b7280`, width 32px (fixed), text-right

**Rating bar colors and labels:**
| Label | Color | Source Field |
|-------|-------|--------------|
| Excellent | `#10b981` (green) | `beginner_friendly_percentage` |
| Average | `#f59e0b` (yellow) | `balanced_percentage` |
| Poor | `#ef4444` (red) | `power_user_percentage` |

**Card footer (bottom):**
- Border top: `1px solid #1f2937`
- Padding-top: 10px
- Layout: flex row, justify-between, items-center
- Left: "XX sources" — 12px, `#6b7280`
- Right: "Updated X ago" — 12px, `#6b7280`
- "X ago" format: "just now", "Xm ago", "Xh ago", "Xd ago", "Xmo ago"

**Category-to-gradient-color mapping (for badge background):**
```typescript
const categoryColors: Record<string, string> = {
  'AI Tools': '#7c3aed',
  'Backend': '#059669',
  'Authentication': '#2563eb',
  'Deployment': '#0d9488',
  'Email': '#16a34a',
  'Database': '#0284c7',
  'Monitoring': '#15803d',
  'ORM': '#1d4ed8',
  'DevOps': '#1e40af',
  'Cloud': '#d97706',
  'Frontend': '#7c3aed',
  'Productivity': '#ca8a04',
  'Security': '#dc2626',
}

const categoryGradients: Record<string, string> = {
  'AI Tools': 'linear-gradient(135deg, #7c3aed, #a855f7)',
  'Backend': 'linear-gradient(135deg, #059669, #34d399)',
  'Authentication': 'linear-gradient(135deg, #2563eb, #60a5fa)',
  'Deployment': 'linear-gradient(135deg, #0d9488, #5eead4)',
  'Email': 'linear-gradient(135deg, #16a34a, #4ade80)',
  'Database': 'linear-gradient(135deg, #0284c7, #38bdf8)',
  'Monitoring': 'linear-gradient(135deg, #15803d, #4ade80)',
  'ORM': 'linear-gradient(135deg, #1d4ed8, #60a5fa)',
  'DevOps': 'linear-gradient(135deg, #1e40af, #60a5fa)',
  'Cloud': 'linear-gradient(135deg, #d97706, #fbbf24)',
  'Frontend': 'linear-gradient(135deg, #7c3aed, #c084fc)',
  'Productivity': 'linear-gradient(135deg, #ca8a04, #facc15)',
  'Security': 'linear-gradient(135deg, #dc2626, #f87171)',
}
```

**Full tool card implementation:**
```tsx
import Image from 'next/image'
import type { ToolWithAnalysis } from '@/lib/mock-data'
import { categoryColors, categoryGradients } from '@/lib/constants'

interface ToolCardProps {
  tool: ToolWithAnalysis
}

export function ToolCard({ tool }: ToolCardProps) {
  const analysis = tool.tool_analyses
  const source = tool.tool_sources
  const category = analysis?.category || 'Uncategorized'
  const gradient = categoryGradients[category] || 'linear-gradient(135deg, #374151, #4b5563)'
  const badgeColor = categoryColors[category] || '#6b7280'

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-elevated transition-all duration-200 hover:border-border-default hover:shadow-lg">
      {/* Gradient Banner */}
      <div className="relative h-[120px] w-full" style={{ background: gradient }}>
        {/* Category Badge */}
        <span
          className="absolute left-3 top-3 rounded-md px-2 py-0.5 text-[11px] font-medium text-white"
          style={{ backgroundColor: `${badgeColor}cc` }}
        >
          {category}
        </span>

        {/* Info Icon */}
        <button
          className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-black/30 text-[12px] font-semibold text-white hover:bg-black/50"
          aria-label="More info"
        >
          i
        </button>

        {/* Tool Logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white shadow-md">
            <Image
              src={tool.image_url}
              alt={`${tool.name} logo`}
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
              unoptimized
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        {/* Tool Name */}
        <h3 className="text-base font-semibold text-text-primary">{tool.name}</h3>

        {/* Subtitle */}
        <p className="mb-2 text-xs text-text-muted">{source.name}</p>

        {/* Description */}
        <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-text-secondary">
          {analysis?.summary || 'No description available.'}
        </p>

        {/* Rating Bars */}
        <div className="mb-3 space-y-1.5">
          <RatingBar
            label="Excellent"
            percentage={analysis?.beginner_friendly_percentage || 0}
            color="#10b981"
          />
          <RatingBar
            label="Average"
            percentage={analysis?.balanced_percentage || 0}
            color="#f59e0b"
          />
          <RatingBar
            label="Poor"
            percentage={analysis?.power_user_percentage || 0}
            color="#ef4444"
          />
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t border-border-subtle pt-2.5">
          <span className="text-xs text-text-muted">{1} source</span>
          <span className="text-xs text-text-muted">Updated {formatTimeAgo(tool.last_updated)}</span>
        </div>
      </div>
    </article>
  )
}

function RatingBar({ label, percentage, color }: { label: string; percentage: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-[12px] text-text-secondary">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border-subtle">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right text-[12px] text-text-muted">{percentage}%</span>
    </div>
  )
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`
  return `${Math.floor(diffInSeconds / 2592000)}mo ago`
}
```

### 5. Home Page Layout (updated)

Remove the hero section. Category pills go directly below the header.

```tsx
// app/page.tsx
import { Suspense } from 'react'
import { getTools, getCategories } from '@/lib/mock-data'
import { CategoryFilter } from '@/components/category-filter'
import { ToolGrid } from '@/components/tool-grid'
import { EmptyState } from '@/components/empty-state'

interface HomePageProps {
  searchParams: Promise<{ category?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams
  const category = params.category || 'All'

  const tools = getTools(category === 'All' ? undefined : category)
  const categories = getCategories()

  return (
    <div className="flex flex-1 flex-col">
      {/* Category Filter — directly below header */}
      <div className="border-b border-border-subtle bg-surface py-3">
        <div className="mx-auto max-w-grid-container px-grid-margin">
          <Suspense fallback={<div className="h-9" />}>
            <CategoryFilter categories={categories} activeCategory={category} />
          </Suspense>
        </div>
      </div>

      {/* Main Content */}
      <section className="flex-1 py-6">
        <div className="mx-auto max-w-grid-container px-grid-margin">
          {/* Section Header */}
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text-primary">
              {category === 'All' ? 'All Tools' : category}
            </h2>
          </div>

          {/* Tool Grid or Empty State */}
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

### 6. Footer (complete rewrite)

**Layout:**
- Background: `#111827` (`bg-surface`)
- Border top: `1px solid #1f2937`
- Padding: `py-12`

**Top section — 4-column grid:**

**Column 1 — Brand:**
- Logo: same green circle with `</>` as header
- "DevScout AI": 14px, semibold, white
- "Developer Tools Discovery Platform": 12px, `#6b7280`
- Tagline: 14px, `#9ca3af`, margin-top 12px, max-width 280px

**Column 2 — Company:**
- Heading: "Company", 14px, semibold, white, margin-bottom 12px
- Links: About, Careers, Press, Contact
- Link style: 14px, `#9ca3af`, hover white

**Column 3 — Resources:**
- Heading: "Resources", 14px, semibold, white, margin-bottom 12px
- Links: Blog, Guides, API, Changelog
- Link style: 14px, `#9ca3af`, hover white

**Column 4 — Newsletter + Social:**
- Heading: "Stay Updated", 14px, semibold, white, margin-bottom 8px
- Description: "Get the best developer tools straight to your inbox.", 14px, `#9ca3af`, margin-bottom 12px
- Form: email input + Subscribe button, flex row, gap 8px
  - Input: background `#1f2937`, border `#374151`, text white, placeholder `#6b7280`
  - Subscribe button: purple gradient same as header

**Social icons row (below newsletter, above bottom bar):**
- Four icons: X (Twitter), GitHub, Discord, LinkedIn
- Each icon: 20x20 SVG, `#6b7280`, hover `#9ca3af`
- Layout: flex row, gap 16px
- Margin-top: 24px

**Social icon SVGs:**
- X/Twitter: `<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>`
- GitHub: `<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>`
- Discord: `<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>`
- LinkedIn: `<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>`

**Bottom bar:**
- Border top: `1px solid #1f2937`
- Padding-top: 24px
- Layout: flex row, justify-between, items-center
- Left: "© 2025 DevScout AI. All rights reserved.", 12px, `#6b7280`
- Right: "Made with ♥ for developers", 12px, `#6b7280`
- "♥" in red: `color: #ef4444`

### 7. Constants File

Create `lib/constants.ts` for the category mappings:

```typescript
// lib/constants.ts

export const categoryColors: Record<string, string> = {
  'AI Tools': '#7c3aed',
  'Developer Tools': '#3b82f6',
  'Backend': '#059669',
  'Frontend': '#7c3aed',
  'Database': '#0284c7',
  'DevOps': '#1e40af',
  'Productivity': '#ca8a04',
  'Security': '#dc2626',
  'Cloud': '#d97706',
  'Authentication': '#2563eb',
  'Deployment': '#0d9488',
  'Email': '#16a34a',
  'Monitoring': '#15803d',
  'ORM': '#1d4ed8',
}

export const categoryGradients: Record<string, string> = {
  'AI Tools': 'linear-gradient(135deg, #7c3aed, #a855f7)',
  'Developer Tools': 'linear-gradient(135deg, #3b82f6, #60a5fa)',
  'Backend': 'linear-gradient(135deg, #059669, #34d399)',
  'Frontend': 'linear-gradient(135deg, #7c3aed, #c084fc)',
  'Database': 'linear-gradient(135deg, #0284c7, #38bdf8)',
  'DevOps': 'linear-gradient(135deg, #1e40af, #60a5fa)',
  'Productivity': 'linear-gradient(135deg, #ca8a04, #facc15)',
  'Security': 'linear-gradient(135deg, #dc2626, #f87171)',
  'Cloud': 'linear-gradient(135deg, #d97706, #fbbf24)',
  'Authentication': 'linear-gradient(135deg, #2563eb, #60a5fa)',
  'Deployment': 'linear-gradient(135deg, #0d9488, #5eead4)',
  'Email': 'linear-gradient(135deg, #16a34a, #4ade80)',
  'Monitoring': 'linear-gradient(135deg, #15803d, #4ade80)',
  'ORM': 'linear-gradient(135deg, #1d4ed8, #60a5fa)',
}

export const categoryIcons: Record<string, string> = {
  'All': 'grid',
  'AI Tools': 'sparkles',
  'Developer Tools': 'code',
  'Backend': 'server',
  'Frontend': 'layout',
  'Database': 'database',
  'DevOps': 'git-branch',
  'Productivity': 'zap',
  'Security': 'shield',
  'Cloud': 'cloud',
  'Authentication': 'lock',
  'Deployment': 'rocket',
  'Email': 'mail',
  'Monitoring': 'activity',
  'ORM': 'layers',
}
```

### 8. Visual Summary — Card Layout

```
┌──────────────────────────────────┐
│ ▓▓▓▓▓▓ GRADIENT BANNER ▓▓▓▓▓▓▓▓ │ 120px
│ [Badge]              [Info i]   │
│        ┌──────────┐             │
│        │  TOOL    │             │
│        │  LOGO    │             │
│        └──────────┘             │
├──────────────────────────────────┤
│ Tool Name                        │
│ Company Name                     │
│ Description text that may wrap   │
│ to two lines max...              │
│                                  │
│ Excellent ████████░░░░ 45%       │
│ Average   ██████░░░░░░ 35%       │
│ Poor      ████░░░░░░░░ 20%       │
│──────────────────────────────────│
│ 1 source          Updated 3d ago │
└──────────────────────────────────┘
```

## Security Requirements

- No secrets in client code
- Mock data is local and requires no credentials
- No API calls needed for this UI implementation

## Acceptance Criteria

- [ ] Top bar displays current date, "Set Location", and "International Edition"
- [ ] Header has green circle logo with `</>` icon
- [ ] Subscribe button has purple gradient background and star icon
- [ ] Login button has transparent background with border
- [ ] "For You" nav item has purple "New" badge
- [ ] Category pills have icons, active pill has gradient background
- [ ] Tool cards have colored gradient banner (color matches category)
- [ ] Tool logo is centered in white container within gradient banner
- [ ] Category badge is in top-left of banner with category color
- [ ] Info icon is in top-right of banner
- [ ] Rating bar labels are "Excellent", "Average", "Poor"
- [ ] Rating bars use green, yellow, red colors respectively
- [ ] Card footer shows "XX sources" and "Updated X ago"
- [ ] Footer has social icons (X, GitHub, Discord, LinkedIn)
- [ ] Footer bottom bar has copyright on left, "Made with ♥ for developers" on right
- [ ] All colors match the reference image exactly
- [ ] Typography matches the reference (sizes, weights)
- [ ] Spacing and padding match the reference
- [ ] Responsive: 1 column mobile, 2 tablet, 3 desktop
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Build succeeds

## Checks to Run

After implementation, QA Engineer runs:

```bash
npm run typecheck
npm run lint
npm run build
```

## Manual Test Steps

1. **Start dev server**: `npm run dev`
2. **Open browser**: Navigate to `http://localhost:3000`
3. **Verify top bar**: Shows current date, "Set Location", "International Edition"
4. **Verify header**: Green circle logo, nav items, purple Subscribe button, bordered Login button
5. **Verify category pills**: Scrollable row, icons on each pill, "All" has gradient background
6. **Verify tool cards**: Each card has gradient banner matching its category
7. **Verify card layout**: Logo centered in banner, name/subtitle below, description, rating bars
8. **Verify rating bars**: Green "Excellent", yellow "Average", red "Poor" with correct percentages
9. **Verify card footer**: "1 source" on left, "Updated X ago" on right
10. **Verify footer**: 4-column layout, social icons, newsletter form, copyright and "Made with ♥" on bottom
11. **Verify responsive**: Resize browser to verify 1/2/3 column grid

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-18 | Prompt Engineer | Initial pixel-perfect home page implementation prompt |
