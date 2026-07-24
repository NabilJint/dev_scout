# Tool Details Page UI Implementation Prompt

## Goal

Implement the DevScout AI tool details page that displays a comprehensive view of a single developer tool with AI analysis data. The page features a two-column layout (main content + sidebar), hero section with tool screenshot, metadata cards, AI summary, key features, pros/cons, related tools, newsletter signup, and footer. Data is sourced from local mock data for initial development.

## Assigned Specialist Agent(s)

- **Frontend Engineer** — Primary implementer. Builds all page components, layout, and client-side interactions.

## Skills Read

- `frontend-design` — Production-grade frontend interfaces, dark theme patterns, responsive layouts
- `ui-styling` — Tailwind CSS utilities, shadcn/ui component patterns, CSS variables
- `shadcn` — shadcn/ui component installation, usage, and customization
- `supabase` — Database schema and query patterns (for future integration)
- `node_modules/next/dist/docs/` — Next.js 16 patterns, server/client components, App Router conventions

## Existing Code Inspected

- `app/globals.css` — Design system tokens (colors, typography, spacing, shadows, radius) fully implemented with Tailwind v4 `@theme` blocks
- `app/layout.tsx` — Root layout with Inter font, Header and Footer already integrated
- `lib/design-system/types.ts` — Complete TypeScript type definitions for design tokens
- `components/header.tsx` — Site header component (already implemented)
- `components/footer.tsx` — Site footer component (already implemented)
- `components/ui/button.tsx` — shadcn/ui Button component (already implemented)
- `components/ui/badge.tsx` — shadcn/ui Badge component (already implemented)
- `components/ui/card.tsx` — shadcn/ui Card component (already implemented)
- `components/ui/input.tsx` — shadcn/ui Input component (already implemented)
- `lib/mock-data.ts` — Mock tool data with 12 sample tools and analysis data (already implemented)
- `ui_ref/details_page.png` — UI reference image showing the target design

## Decisions and Assumptions

1. **Use mock data, not Supabase** — A local mock data file (`lib/mock-data.ts`) provides tool data. No Supabase clients, types, or query functions are needed for this implementation.
2. **Data fetching is server-side** — The tool details page is a React Server Component that imports mock data directly. The tool ID comes from the URL path parameter (`/tools/[id]`).
3. **No authentication required for details page** — Clerk auth is not required to view tools. Save/Bookmark/Share buttons are UI-only placeholders (no actual auth flows yet).
4. **Newsletter signup is UI-only** — No backend integration for newsletter subscriptions.
5. **Related tools are derived from mock data** — Related tools are filtered by category from the same mock data file, not by vector similarity (pgvector integration comes later).
6. **Dark theme only** — The UI reference shows dark theme. Light mode is not implemented.
7. **Design system tokens are used exclusively** — All colors, spacing, typography, shadows, and radius must use the tokens from `globals.css`. No hardcoded values.
8. **Responsive breakpoints** — Mobile: <768px (single column), Tablet: 768-1024px (sidebar stacks below main), Desktop: >1024px (two-column layout).
9. **Tool data may not exist** — The page must handle 404 states gracefully when a tool ID doesn't exist.
10. **Score breakdown percentages are mock data** — The reference shows specific percentages (Features 23%, Performance 25%, etc.) that will be hardcoded in the initial implementation. These can be made dynamic later.

## Files Likely to Change

| File | Action | Description |
|------|--------|-------------|
| `app/tools/[id]/page.tsx` | **Create** | Tool details page server component with data fetching |
| `app/tools/[id]/not-found.tsx` | **Create** | Custom 404 page for missing tools |
| `components/tool-details/hero-section.tsx` | **Create** | Hero section with tool icon, badge, name, description, actions |
| `components/tool-details/metadata-row.tsx` | **Create** | 4-card metadata row (Category, Company, Website, Last Updated) |
| `components/tool-details/ai-summary.tsx` | **Create** | AI Summary section |
| `components/tool-details/key-features.tsx` | **Create** | Key Features grid (2 columns) |
| `components/tool-details/pros-cons.tsx` | **Create** | Pros and Cons columns |
| `components/tool-details/best-for.tsx` | **Create** | Best For tags |
| `components/tool-details/integrations.tsx` | **Create** | Integrations list with icons |
| `components/tool-details/related-tools.tsx` | **Create** | Related Tools horizontal scroll |
| `components/tool-details/ai-score-card.tsx` | **Create** | AI Tool Score card (9.1/10 with gradient bar) |
| `components/tool-details/score-breakdown.tsx` | **Create** | Score Breakdown with progress bars |
| `components/tool-details/ai-confidence.tsx` | **Create** | AI Confidence circular gauge (92%) |
| `components/tool-details/source-breakdown.tsx` | **Create** | Source Breakdown with bar chart |
| `components/tool-details/quick-actions.tsx` | **Create** | Quick Actions links |
| `components/tool-details/tool-information.tsx` | **Create** | Tool Information table |
| `components/tool-details/newsletter-section.tsx` | **Create** | Newsletter signup section |
| `components/tool-details/tool-screenshot.tsx` | **Create** | Tool screenshot with code editor UI |
| `lib/mock-data.ts` | **Update** | Add `getToolById()` and `getRelatedTools()` helper functions |

## Implementation Requirements

> **⚠️ IMPORTANT: This is an ITERATIVE process, not a one-shot build.**
> After implementing the UI, you MUST follow the design-matching workflow below (Steps 3-8) to verify pixel-perfect accuracy against the reference design. Do NOT stop after the first implementation.

### Phase 1: Data Layer Updates

#### 1.1 Update Mock Data Helpers

Add to `lib/mock-data.ts`:

```typescript
export function getToolById(id: string): ToolWithAnalysis | undefined {
  return mockTools.find(tool => tool.id === id)
}

export function getRelatedTools(toolId: string, category?: string): ToolWithAnalysis[] {
  return mockTools
    .filter(tool => tool.id !== toolId && tool.tool_analyses?.category === category)
    .slice(0, 5)
}
```

### Phase 2: Component Implementation

#### 2.1 Hero Section Component

**`components/tool-details/hero-section.tsx`** — Server component:

```tsx
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ToolWithAnalysis } from '@/lib/mock-data'

interface HeroSectionProps {
  tool: ToolWithAnalysis
}

export function HeroSection({ tool }: HeroSectionProps) {
  const analysis = tool.tool_analyses

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      {/* Left: Tool Info */}
      <div className="flex-1">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-text-muted">
          <span>Home</span>
          <span className="mx-2">/</span>
          <span>{analysis?.category || 'Tools'}</span>
          <span className="mx-2">/</span>
          <span className="text-text-secondary">{tool.name}</span>
        </nav>

        {/* Category Badge */}
        <Badge variant="primary" className="mb-4">
          {analysis?.category || 'Uncategorized'}
        </Badge>

        {/* Tool Name */}
        <h1 className="mb-4 text-4xl font-bold text-text-primary lg:text-5xl">
          {tool.name} – {analysis?.main_purpose || 'Developer Tool'}
        </h1>

        {/* Description */}
        <p className="mb-6 text-lg leading-relaxed text-text-secondary">
          {analysis?.summary || 'No description available.'}
        </p>

        {/* Author and Meta */}
        <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-text-muted">
          <span>By DevScout AI Team</span>
          <span>·</span>
          <span>{new Date(tool.last_updated).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <span>·</span>
          <span>12 min read</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm">
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            Save
          </Button>
          <Button variant="secondary" size="sm">
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Bookmark
          </Button>
          <Button variant="secondary" size="sm">
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </Button>
        </div>
      </div>

      {/* Right: Tool Score Card */}
      <div className="lg:w-80">
        {/* AI Tool Score Card will be rendered here by parent */}
      </div>
    </div>
  )
}
```

#### 2.2 AI Tool Score Card Component

**`components/tool-details/ai-score-card.tsx`** — Server component:

```tsx
import type { ToolWithAnalysis } from '@/lib/mock-data'

interface AIScoreCardProps {
  tool: ToolWithAnalysis
}

export function AIScoreCard({ tool }: AIScoreCardProps) {
  const analysis = tool.tool_analyses
  const score = analysis ? (analysis.confidence * 10).toFixed(1) : '0.0'
  
  // Calculate a mock score based on confidence
  const mockScore = 9.1
  const scoreLabel = mockScore >= 8 ? 'Excellent' : mockScore >= 6 ? 'Good' : 'Average'
  const scoreColor = mockScore >= 8 ? 'text-positive' : mockScore >= 6 ? 'text-warning' : 'text-negative'

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-elevated p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">AI Tool Score</h3>
        <button className="text-text-muted hover:text-text-secondary" aria-label="More info">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="10" cy="10" r="8.5" />
            <path d="M10 9v5M10 7v0" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Score Display */}
      <div className="mb-2 flex items-baseline gap-1">
        <span className="text-5xl font-bold text-text-primary">{mockScore}</span>
        <span className="text-2xl text-text-muted">/10</span>
      </div>

      {/* Score Label */}
      <div className="mb-4 flex items-center gap-2">
        <span className={`text-sm font-medium ${scoreColor}`}>● {scoreLabel}</span>
      </div>

      {/* Score Bar */}
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-n-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-positive via-warning to-negative"
          style={{ width: `${(mockScore / 10) * 100}%` }}
        />
      </div>

      {/* Source Count */}
      <p className="text-xs text-text-muted">Based on 18 analyzed sources</p>
    </div>
  )
}
```

#### 2.3 Metadata Row Component

**`components/tool-details/metadata-row.tsx`** — Server component:

```tsx
import type { ToolWithAnalysis } from '@/lib/mock-data'

interface MetadataRowProps {
  tool: ToolWithAnalysis
}

export function MetadataRow({ tool }: MetadataRowProps) {
  const analysis = tool.tool_analyses
  const source = tool.tool_sources

  const metadata = [
    {
      icon: (
        <svg className="h-5 w-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
        </svg>
      ),
      label: 'Category',
      value: analysis?.category || 'Uncategorized',
    },
    {
      icon: (
        <svg className="h-5 w-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
        </svg>
      ),
      label: 'Company',
      value: source.name,
    },
    {
      icon: (
        <svg className="h-5 w-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
      ),
      label: 'Website',
      value: source.listing_url.replace('https://', ''),
      href: source.listing_url,
    },
    {
      icon: (
        <svg className="h-5 w-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: 'Last Updated',
      value: 'Today',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {metadata.map((item) => (
        <div
          key={item.label}
          className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-elevated p-4"
        >
          <div className="flex items-center gap-2">
            {item.icon}
            <span className="text-xs text-text-muted">{item.label}</span>
          </div>
          {item.href ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              {item.value}
            </a>
          ) : (
            <span className="text-sm font-medium text-text-primary">{item.value}</span>
          )}
        </div>
      ))}
    </div>
  )
}
```

#### 2.4 AI Summary Component

**`components/tool-details/ai-summary.tsx`** — Server component:

```tsx
import type { ToolWithAnalysis } from '@/lib/mock-data'

interface AISummaryProps {
  tool: ToolWithAnalysis
}

export function AISummary({ tool }: AISummaryProps) {
  const analysis = tool.tool_analyses

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-elevated p-6">
      <h2 className="mb-4 text-xl font-semibold text-text-primary">AI Summary</h2>
      <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
        <p>{analysis?.summary || 'No summary available.'}</p>
        <p>
          Built on VS Code and supercharged with AI, Cursor helps you write code faster,
          understand complex projects, and ship high-quality software.
        </p>
      </div>
    </section>
  )
}
```

#### 2.5 Key Features Component

**`components/tool-details/key-features.tsx`** — Server component:

```tsx
import type { ToolWithAnalysis } from '@/lib/mock-data'

interface KeyFeaturesProps {
  tool: ToolWithAnalysis
}

export function KeyFeatures({ tool }: KeyFeaturesProps) {
  const analysis = tool.tool_analyses
  const features = analysis?.key_features || []

  // Split features into two columns
  const midpoint = Math.ceil(features.length / 2)
  const leftColumn = features.slice(0, midpoint)
  const rightColumn = features.slice(midpoint)

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-elevated p-6">
      <h2 className="mb-4 text-xl font-semibold text-text-primary">Key Features</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-3">
          {leftColumn.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-text-secondary">{feature}</span>
            </div>
          ))}
        </div>

        {/* Right Column */}
        <div className="space-y-3">
          {rightColumn.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-text-secondary">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

#### 2.6 Pros and Cons Component

**`components/tool-details/pros-cons.tsx`** — Server component:

```tsx
import type { ToolWithAnalysis } from '@/lib/mock-data'

interface ProsConsProps {
  tool: ToolWithAnalysis
}

export function ProsCons({ tool }: ProsConsProps) {
  const analysis = tool.tool_analyses
  const pros = analysis?.pros || []
  const cons = analysis?.cons || []

  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Pros */}
      <div className="rounded-xl border border-border-subtle bg-surface-elevated p-6">
        <h2 className="mb-4 text-xl font-semibold text-positive">Pros</h2>
        <div className="space-y-3">
          {pros.map((pro, index) => (
            <div key={index} className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-positive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-text-secondary">{pro}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cons */}
      <div className="rounded-xl border border-border-subtle bg-surface-elevated p-6">
        <h2 className="mb-4 text-xl font-semibold text-negative">Cons</h2>
        <div className="space-y-3">
          {cons.map((con, index) => (
            <div key={index} className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-negative"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-sm text-text-secondary">{con}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

#### 2.7 Best For Component

**`components/tool-details/best-for.tsx`** — Server component:

```tsx
import { Badge } from '@/components/ui/badge'
import type { ToolWithAnalysis } from '@/lib/mock-data'

interface BestForProps {
  tool: ToolWithAnalysis
}

export function BestFor({ tool }: BestForProps) {
  const analysis = tool.tool_analyses
  const targetUsers = analysis?.target_users || ''

  // Parse target users into tags
  const tags = targetUsers
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-elevated p-6">
      <h2 className="mb-4 text-xl font-semibold text-text-primary">Best For</h2>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <Badge key={index} variant="default" className="bg-n-700 text-text-secondary">
            {tag}
          </Badge>
        ))}
      </div>
    </section>
  )
}
```

#### 2.8 Integrations Component

**`components/tool-details/integrations.tsx`** — Server component:

```tsx
import type { ToolWithAnalysis } from '@/lib/mock-data'

interface IntegrationsProps {
  tool: ToolWithAnalysis
}

// Mock integration icons (in production, use real icons)
const integrationIcons: Record<string, string> = {
  GitHub: 'GH',
  GitLab: 'GL',
  'VS Code Extensions': 'VS',
  Slack: 'SL',
  Linear: 'LI',
  Notion: 'NO',
  React: 'RE',
  'Next.js': 'NX',
  Vue: 'VU',
  Svelte: 'SV',
}

export function Integrations({ tool }: IntegrationsProps) {
  const analysis = tool.tool_analyses
  const integrations = analysis?.integrations || []

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-elevated p-6">
      <h2 className="mb-4 text-xl font-semibold text-text-primary">Integrations</h2>
      <div className="flex flex-wrap gap-4">
        {integrations.map((integration, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-n-700 text-xs font-medium text-text-secondary">
              {integrationIcons[integration] || integration.substring(0, 2).toUpperCase()}
            </div>
            <span className="text-sm text-text-secondary">{integration}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
```

#### 2.9 Related Tools Component

**`components/tool-details/related-tools.tsx`** — Server component:

```tsx
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import type { ToolWithAnalysis } from '@/lib/mock-data'

interface RelatedToolsProps {
  tools: ToolWithAnalysis[]
}

export function RelatedTools({ tools }: RelatedToolsProps) {
  if (tools.length === 0) return null

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-elevated p-6">
      <h2 className="mb-4 text-xl font-semibold text-text-primary">Related Tools</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {tools.map((tool) => {
          const analysis = tool.tool_analyses
          const score = analysis ? (analysis.confidence * 10).toFixed(1) : '0.0'

          return (
            <div
              key={tool.id}
              className="flex w-48 flex-shrink-0 flex-col rounded-xl border border-border-subtle bg-n-700 p-4 transition-all hover:border-border-default"
            >
              {/* Category Badge */}
              <Badge variant="primary" className="mb-3 w-fit text-xs">
                {analysis?.category || 'Tool'}
              </Badge>

              {/* Tool Icon */}
              <div className="mb-3 flex h-12 items-center justify-center">
                <Image
                  src={tool.image_url}
                  alt={`${tool.name} logo`}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-xl object-contain"
                  unoptimized
                />
              </div>

              {/* Tool Name */}
              <h3 className="mb-1 text-sm font-semibold text-text-primary">{tool.name}</h3>

              {/* Description */}
              <p className="mb-3 line-clamp-2 text-xs text-text-muted">
                {analysis?.summary?.substring(0, 60) || 'Developer tool'}...
              </p>

              {/* Score */}
              <div className="mt-auto flex items-center gap-1 text-xs text-text-secondary">
                <svg
                  className="h-4 w-4 text-positive"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>{score}/10</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

#### 2.10 Score Breakdown Component

**`components/tool-details/score-breakdown.tsx`** — Server component:

```tsx
interface ScoreBreakdownProps {
  scores?: {
    features: number
    performance: number
    easeOfUse: number
    community: number
    pricing: number
  }
}

export function ScoreBreakdown({ scores }: ScoreBreakdownProps) {
  // Default mock scores from reference design
  const defaultScores = {
    features: 23,
    performance: 25,
    easeOfUse: 20,
    community: 17,
    pricing: 15,
  }

  const data = scores || defaultScores

  const breakdown = [
    { label: 'Features', value: data.features, color: 'bg-primary' },
    { label: 'Performance', value: data.performance, color: 'bg-positive' },
    { label: 'Ease of Use', value: data.easeOfUse, color: 'bg-info' },
    { label: 'Community', value: data.community, color: 'bg-warning' },
    { label: 'Pricing', value: data.pricing, color: 'bg-negative' },
  ]

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-elevated p-6">
      <h3 className="mb-4 text-lg font-semibold text-text-primary">Score Breakdown</h3>
      <div className="space-y-4">
        {breakdown.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm text-text-secondary">{item.label}</span>
              <span className="text-sm text-text-muted">{item.value}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-n-700">
              <div
                className={`h-full rounded-full ${item.color}`}
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### 2.11 AI Confidence Component

**`components/tool-details/ai-confidence.tsx`** — Server component:

```tsx
interface AIConfidenceProps {
  confidence?: number
}

export function AIConfidence({ confidence = 0.92 }: AIConfidenceProps) {
  const percentage = Math.round(confidence * 100)
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-elevated p-6">
      <h3 className="mb-4 text-lg font-semibold text-text-primary">AI Confidence</h3>
      
      {/* Circular Gauge */}
      <div className="mb-4 flex justify-center">
        <div className="relative h-32 w-32">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-n-700"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="text-primary transition-all duration-500"
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-text-primary">{percentage}%</span>
          </div>
        </div>
      </div>

      {/* Label */}
      <div className="text-center">
        <span className="text-sm font-medium text-positive">High Confidence</span>
      </div>

      {/* Description */}
      <p className="mt-3 text-center text-xs text-text-muted">
        Our AI has high confidence in this analysis based on comprehensive source evaluation.
      </p>

      {/* How we calculate link */}
      <div className="mt-4 text-center">
        <button className="text-xs text-text-muted hover:text-text-secondary">
          How we calculate confidence →
        </button>
      </div>
    </div>
  )
}
```

#### 2.12 Source Breakdown Component

**`components/tool-details/source-breakdown.tsx`** — Server component:

```tsx
interface SourceBreakdownProps {
  sources?: {
    total: number
    topReviews: number
    officialDocs: number
    community: number
    newsAndBlogs: number
  }
}

export function SourceBreakdown({ sources }: SourceBreakdownProps) {
  // Default mock data from reference design
  const defaultSources = {
    total: 18,
    topReviews: 8,
    officialDocs: 4,
    community: 3,
    newsAndBlogs: 3,
  }

  const data = sources || defaultSources

  const breakdown = [
    { label: 'Top Reviews', count: data.topReviews, color: 'bg-primary' },
    { label: 'Official Docs', count: data.officialDocs, color: 'bg-info' },
    { label: 'Community', count: data.community, color: 'bg-positive' },
    { label: 'News & Blogs', count: data.newsAndBlogs, color: 'bg-warning' },
  ]

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-elevated p-6">
      <h3 className="mb-2 text-lg font-semibold text-text-primary">Source Breakdown</h3>
      <p className="mb-4 text-sm text-text-muted">{data.total} Total Sources</p>

      <div className="space-y-3">
        {breakdown.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-sm ${item.color}`} />
              <span className="text-sm text-text-secondary">{item.label}</span>
            </div>
            <span className="text-sm text-text-muted">
              {item.count} ({Math.round((item.count / data.total) * 100)}%)
            </span>
          </div>
        ))}
      </div>

      <button className="mt-4 w-full rounded-lg border border-border-subtle bg-n-700 py-2 text-sm font-medium text-text-primary hover:bg-n-600">
        View All Sources
      </button>
    </div>
  )
}
```

#### 2.13 Quick Actions Component

**`components/tool-details/quick-actions.tsx`** — Server component:

```tsx
interface QuickActionsProps {
  websiteUrl?: string
  documentationUrl?: string
  githubUrl?: string
}

export function QuickActions({
  websiteUrl = '#',
  documentationUrl = '#',
  githubUrl = '#',
}: QuickActionsProps) {
  const actions = [
    {
      label: 'Visit Official Website',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
      ),
      href: websiteUrl,
    },
    {
      label: 'Documentation',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      ),
      href: documentationUrl,
    },
    {
      label: 'GitHub Repository',
      icon: (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
        </svg>
      ),
      href: githubUrl,
    },
    {
      label: 'Compare Alternatives',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      ),
      href: '/compare',
    },
  ]

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-elevated p-6">
      <h3 className="mb-4 text-lg font-semibold text-text-primary">Quick Actions</h3>
      <div className="space-y-2">
        {actions.map((action) => (
          <a
            key={action.label}
            href={action.href}
            target={action.href.startsWith('http') ? '_blank' : undefined}
            rel={action.href.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="flex items-center justify-between rounded-lg border border-border-subtle bg-n-700 px-4 py-3 text-sm text-text-primary transition-colors hover:bg-n-600"
          >
            <div className="flex items-center gap-3">
              {action.icon}
              <span>{action.label}</span>
            </div>
            <svg className="h-4 w-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  )
}
```

#### 2.14 Tool Information Component

**`components/tool-details/tool-information.tsx`** — Server component:

```tsx
import type { ToolWithAnalysis } from '@/lib/mock-data'

interface ToolInformationProps {
  tool: ToolWithAnalysis
}

export function ToolInformation({ tool }: ToolInformationProps) {
  const analysis = tool.tool_analyses
  const source = tool.tool_sources

  const info = [
    { label: 'Developer', value: source.name },
    { label: 'Launched', value: '2023' },
    { label: 'Pricing', value: analysis?.pricing_model || 'Unknown' },
    { label: 'Platforms', value: 'macOS, Windows, Linux' },
    { label: 'Languages', value: 'All Major Languages' },
  ]

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-elevated p-6">
      <h3 className="mb-4 text-lg font-semibold text-text-primary">Tool Information</h3>
      <div className="space-y-3">
        {info.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-sm text-text-muted">{item.label}</span>
            <span className="text-sm font-medium text-text-primary">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### 2.15 Newsletter Section Component

**`components/tool-details/newsletter-section.tsx`** — Server component:

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function NewsletterSection() {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-elevated p-8">
      <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
        {/* Left: Text */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
            <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              Stay ahead with developer tools insights
            </h3>
            <p className="text-sm text-text-secondary">
              Get the latest tools, AI analysis, and developer news delivered to your inbox.
            </p>
          </div>
        </div>

        {/* Right: Form */}
        <div className="flex w-full gap-3 md:w-auto">
          <Input
            type="email"
            placeholder="Enter your email"
            className="w-full md:w-64"
          />
          <Button variant="primary" size="default">
            Subscribe
          </Button>
        </div>
      </div>
    </section>
  )
}
```

#### 2.16 Tool Screenshot Component

**`components/tool-details/tool-screenshot.tsx`** — Server component:

```tsx
import Image from 'next/image'
import type { ToolWithAnalysis } from '@/lib/mock-data'

interface ToolScreenshotProps {
  tool: ToolWithAnalysis
}

export function ToolScreenshot({ tool }: ToolScreenshotProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle">
      {/* Window Chrome */}
      <div className="flex items-center gap-2 bg-n-800 px-4 py-2">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-negative" />
          <div className="h-3 w-3 rounded-full bg-warning" />
          <div className="h-3 w-3 rounded-full bg-positive" />
        </div>
        <div className="flex-1 text-center text-xs text-text-muted">{tool.name}</div>
        <div className="w-12" />
      </div>

      {/* Screenshot Content */}
      <div className="relative aspect-video bg-n-900">
        <Image
          src={tool.image_url}
          alt={`${tool.name} screenshot`}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
    </div>
  )
}
```

### Phase 3: Tool Details Page Assembly

#### 3.1 Tool Details Page

**`app/tools/[id]/page.tsx`** — Server component:

```tsx
import { notFound } from 'next/navigation'
import { getToolById, getRelatedTools } from '@/lib/mock-data'
import { HeroSection } from '@/components/tool-details/hero-section'
import { AIScoreCard } from '@/components/tool-details/ai-score-card'
import { MetadataRow } from '@/components/tool-details/metadata-row'
import { ToolScreenshot } from '@/components/tool-details/tool-screenshot'
import { AISummary } from '@/components/tool-details/ai-summary'
import { KeyFeatures } from '@/components/tool-details/key-features'
import { ProsCons } from '@/components/tool-details/pros-cons'
import { BestFor } from '@/components/tool-details/best-for'
import { Integrations } from '@/components/tool-details/integrations'
import { RelatedTools } from '@/components/tool-details/related-tools'
import { ScoreBreakdown } from '@/components/tool-details/score-breakdown'
import { AIConfidence } from '@/components/tool-details/ai-confidence'
import { SourceBreakdown } from '@/components/tool-details/source-breakdown'
import { QuickActions } from '@/components/tool-details/quick-actions'
import { ToolInformation } from '@/components/tool-details/tool-information'
import { NewsletterSection } from '@/components/tool-details/newsletter-section'

interface ToolDetailsPageProps {
  params: Promise<{ id: string }>
}

export default async function ToolDetailsPage({ params }: ToolDetailsPageProps) {
  const { id } = await params
  const tool = getToolById(id)

  if (!tool) {
    notFound()
  }

  const relatedTools = getRelatedTools(id, tool.tool_analyses?.category)

  return (
    <div className="flex flex-1 flex-col">
      <section className="py-8">
        <div className="mx-auto max-w-grid-container px-grid-margin">
          {/* Hero Section with Score Card */}
          <div className="mb-8 flex flex-col gap-8 lg:flex-row">
            <div className="flex-1">
              <HeroSection tool={tool} />
            </div>
            <div className="lg:w-80">
              <AIScoreCard tool={tool} />
            </div>
          </div>

          {/* Tool Screenshot */}
          <div className="mb-8">
            <ToolScreenshot tool={tool} />
          </div>

          {/* Metadata Row */}
          <div className="mb-8">
            <MetadataRow tool={tool} />
          </div>

          {/* Two Column Layout */}
          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Main Content */}
            <div className="flex-1 space-y-8">
              <AISummary tool={tool} />
              <KeyFeatures tool={tool} />
              <ProsCons tool={tool} />
              <BestFor tool={tool} />
              <Integrations tool={tool} />
              <RelatedTools tools={relatedTools} />
            </div>

            {/* Sidebar */}
            <div className="w-full space-y-6 lg:w-80">
              <ScoreBreakdown />
              <AIConfidence />
              <SourceBreakdown />
              <QuickActions websiteUrl={tool.tool_sources.listing_url} />
              <ToolInformation tool={tool} />
            </div>
          </div>

          {/* Newsletter Section */}
          <div className="mt-8">
            <NewsletterSection />
          </div>
        </div>
      </section>
    </div>
  )
}
```

#### 3.2 Not Found Page

**`app/tools/[id]/not-found.tsx`** — Client component:

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-elevated">
        <svg
          className="h-8 w-8 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </div>
      <h2 className="mb-2 text-2xl font-bold text-text-primary">Tool Not Found</h2>
      <p className="mb-6 max-w-md text-text-secondary">
        The tool you're looking for doesn't exist or has been removed. Try searching for another tool.
      </p>
      <Link href="/">
        <Button variant="primary">Back to Home</Button>
      </Link>
    </div>
  )
}
```

## Design-Matching Workflow (Required)

After completing the implementation in Phase 1-3 above, you MUST follow this iterative workflow to verify the UI matches the reference design pixel-perfectly. This is NOT optional — it is a required part of the implementation process.

### Step 3: Run and Capture

1. Start the development server: `npm run dev`
2. Open the tool details page in your browser: `http://localhost:3000/tools/1`
3. Take a screenshot of the implemented page at desktop width (>1024px)
4. Save the screenshot as `screenshots/implementation-v1.png`

### Step 4: AI Comparison

Compare your screenshot against the reference design at `ui_ref/details_page.png`. For EVERY visual element, classify it as one of:

- **Matches** — element looks correct with high confidence
- **Likely matches** — close but uncertain, needs human check
- **Differs** — clearly different, describe what's wrong

Check these specific elements:
- Hero section layout (two-column vs stacked)
- AI Tool Score card positioning and styling
- Tool screenshot section with window chrome
- Metadata row (4 cards in a row)
- Two-column layout (main content + sidebar)
- AI Summary section styling
- Key Features grid (2 columns)
- Pros/Cons columns
- Best For tags
- Integrations list
- Related Tools horizontal scroll
- Score Breakdown progress bars
- AI Confidence circular gauge
- Source Breakdown legend
- Quick Actions buttons
- Tool Information table
- Newsletter section
- Footer
- Card borders and border-radius
- Typography sizes and weights
- Color scheme (dark theme)
- Spacing and padding patterns
- Shadows and elevation

### Step 5: Output Implementation Summary

List every design decision with exact values used:

```
Design Implementation Summary
============================

Layout:
- padding: Xpx (horizontal), Xpx (vertical)
- margin: Xpx (between sections)
- gap: Xpx (grid gaps)

Cards:
- border-radius: Xpx
- border: Xpx solid #XXXXXX
- shadow: [values]
- background: #XXXXXX

Typography:
- H1: Xpx, font-weight: X, line-height: X
- H2: Xpx, font-weight: X, line-height: X
- H3: Xpx, font-weight: X, line-height: X
- Body: Xpx, font-weight: X, line-height: X
- Caption: Xpx, font-weight: X, line-height: X

Colors:
- Background: #XXXXXX
- Surface elevated: #XXXXXX
- Border subtle: #XXXXXX
- Text primary: #XXXXXX
- Text secondary: #XXXXXX
- Text muted: #XXXXXX
- Primary accent: #XXXXXX

Interactive Elements:
- Button height: Xpx
- Button padding: Xpx Xpx
- Button border-radius: Xpx
- Input height: Xpx
- Input border-radius: Xpx

Score Elements:
- Score bar height: Xpx
- Score bar border-radius: Xpx
- Confidence gauge size: Xpx
- Confidence gauge stroke: Xpx

Specific Components:
- AI Score Card: [details]
- Score Breakdown: [details]
- AI Confidence: [details]
- Source Breakdown: [details]
- Quick Actions: [details]
- Tool Information: [details]
```

### Step 6: Request Human Review

When you are confident the implementation matches the reference, present the CEO with:

1. Your screenshot (`screenshots/implementation-v1.png`)
2. The reference image (`ui_ref/details_page.png`)
3. Your implementation values (from Step 5)
4. Your AI comparison findings (from Step 4)

Then say:
> "I believe the implementation now matches the reference. Please review and confirm, or let me know what still needs to change."

- If the CEO confirms → proceed to Step 8 (Cleanup)
- If the CEO requests changes → go to Step 7 (Iterate)

### Step 7: Iterate

Take the CEO's feedback. Fix each issue. Re-screenshot. Compare again. Repeat until both you and the CEO agree the implementation matches the reference.

For each iteration:
1. Fix the issues identified
2. Re-run `npm run dev`
3. Take a new screenshot: `screenshots/implementation-v2.png` (increment version)
4. Re-compare against reference
5. Present updated findings to CEO

### Step 8: Cleanup

After the CEO approves that the implementation matches the reference:
1. Delete all temporary screenshots: `rm -rf screenshots/`
2. Do NOT leave screenshot files in the project
3. Confirm the final implementation is clean

## Visual Interpretation, Layout, Typography, Spacing, Colors, Responsiveness

### Visual Interpretation (from UI Reference)

The tool details page follows a dark-themed developer tools detail layout:

- **Background**: Very dark blue-black (#080D12) with slightly elevated surfaces (#111827)
- **Cards**: Elevated surface (#1F2937) with subtle borders (#374151)
- **Primary accent**: Indigo/purple (#6366F1) for buttons, badges, and interactive elements
- **Text hierarchy**: Primary (#F9FAFB) for headings, Secondary (#9CA3AF) for body, Muted (#6B7280) for metadata
- **Score bar gradient**: Green (#10B981) → Yellow (#F59E0B) → Red (#EF4444)
- **Confidence gauge**: Indigo (#6366F1) for progress, #1F2937 for background track

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Header (sticky, blur backdrop)                             │
│ [Logo] [Nav Links] [Subscribe] [Login]                    │
├─────────────────────────────────────────────────────────────┤
│ Breadcrumb: Home > AI Coding > Cursor                      │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐ ┌────────────────────────┐ │
│ │ Hero Section                │ │ AI Tool Score Card     │ │
│ │ [Badge] [Title] [Desc]     │ │ 9.1/10 Excellent      │ │
│ │ [Author] [Date] [Actions]  │ │ [Gradient Bar]        │ │
│ └─────────────────────────────┘ └────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Tool Screenshot (code editor mockup)                       │
├─────────────────────────────────────────────────────────────┤
│ [Category] [Company] [Website] [Last Updated]              │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐ ┌────────────────────────┐ │
│ │ AI Summary                  │ │ Score Breakdown        │ │
│ │ Key Features (2 cols)       │ │ Features 23%           │ │
│ │ Pros / Cons (2 cols)        │ │ Performance 25%        │ │
│ │ Best For (tags)             │ │ Ease of Use 20%        │ │
│ │ Integrations (icons)        │ │ Community 17%          │ │
│ │ Related Tools (scroll)      │ │ Pricing 15%            │ │
│ │                             │ ├────────────────────────┤ │
│ │                             │ │ AI Confidence 92%      │ │
│ │                             │ │ [Circular Gauge]       │ │
│ │                             │ ├────────────────────────┤ │
│ │                             │ │ Source Breakdown       │ │
│ │                             │ │ 18 Total Sources       │ │
│ │                             │ ├────────────────────────┤ │
│ │                             │ │ Quick Actions          │ │
│ │                             │ │ Visit Website          │ │
│ │                             │ │ Documentation          │ │
│ │                             │ │ GitHub                 │ │
│ │                             │ │ Compare                │ │
│ │                             │ ├────────────────────────┤ │
│ │                             │ │ Tool Information       │ │
│ │                             │ │ Developer, Launched... │ │
│ └─────────────────────────────┘ └────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Newsletter Section                                          │
│ [Icon] Stay ahead with developer tools insights            │
│ [Email Input] [Subscribe]                                  │
├─────────────────────────────────────────────────────────────┤
│ Footer                                                      │
│ [Logo] [Company] [Resources] [Support] [Newsletter]        │
│ [Social Icons] [Legal] [Copyright]                         │
└─────────────────────────────────────────────────────────────┘
```

### Typography

- **Page Title (H1)**: 2.25rem (36px) → 3rem (48px) on desktop, font-weight 700, line-height 1.2
- **Section Headers (H2)**: 1.25rem (20px), font-weight 600, line-height 1.3
- **Sidebar Headers (H3)**: 1.125rem (18px), font-weight 600, line-height 1.3
- **Body**: 0.875rem (14px), font-weight 400, line-height 1.6
- **Caption**: 0.6875rem (11px), font-weight 400, line-height 1.4
- **Score Display**: 3rem (48px), font-weight 700
- **Font Family**: Inter (system-ui fallback)

### Spacing

- **Page padding**: 1.5rem (24px) horizontal — `px-grid-margin`
- **Section padding**: 1.5rem (24px) — `p-6`
- **Section spacing**: 2rem (32px) vertical — `space-y-8`
- **Grid gap**: 2rem (32px) — `gap-8`
- **Card internal spacing**: 1rem (16px) between elements — `mb-4`
- **Feature list gap**: 0.75rem (12px) — `space-y-3`

### Responsiveness

| Breakpoint | Layout | Sidebar | Navigation |
|------------|--------|---------|------------|
| Mobile (<768px) | Single column | Stacks below main | Hamburger (hidden) |
| Tablet (768-1024px) | Single column | Stacks below main | Horizontal |
| Desktop (>1024px) | Two columns (main + sidebar) | Fixed width 320px | Horizontal |

- **Hero section**: Stacks vertically on mobile, side-by-side on desktop
- **Metadata row**: 2 columns on mobile, 4 columns on desktop
- **Key features**: 1 column on mobile, 2 columns on desktop
- **Pros/Cons**: 1 column on mobile, 2 columns on desktop
- **Related tools**: Horizontal scroll with snap points
- **Sidebar**: Full width on mobile, fixed 320px on desktop

### Pixel-Perfect Expectations

- Card border-radius: 12px (`rounded-xl`)
- Card border: 1px solid #374151 (`border-border-subtle`)
- Badge border-radius: 9999px (`rounded-full`)
- Score bar height: 8px (`h-2`)
- Score bar border-radius: 9999px (`rounded-full`)
- Confidence gauge: 128x128px with 8px stroke width
- Tool screenshot: Aspect ratio 16:9 with window chrome
- Quick action buttons: 48px height with 16px horizontal padding
- Metadata cards: Equal width grid with 16px gap

## Data Requirements

### Fields to Fetch from Supabase (Future Integration)

From `tools` table:
- `id`
- `name`
- `image_url`
- `original_url` / `canonical_url`
- `last_updated`
- `scraped_at`
- `analyzed_at`

From `tool_analyses` table:
- `summary`
- `adoption_score` / `adoption_label`
- `tool_rating_label`
- `beginner_friendly_percentage` / `balanced_percentage` / `power_user_percentage`
- `complexity_score`
- `confidence`
- `main_purpose`
- `category`
- `target_users`
- `key_features` (array)
- `pros` (array)
- `cons` (array)
- `pricing_model`
- `integrations` (array)
- `best_for`
- `marketing_buzzwords` (array)
- `rating_notes`
- `disclaimer`
- `model`

From `tool_sources` table:
- `name`
- `listing_url`
- `logo_url`

### Mock Data Fields

The mock data file (`lib/mock-data.ts`) already includes all necessary fields. No additional mock data is required.

## Security Requirements

- **No secrets in client code** — Mock data is local and requires no credentials
- **No authentication required** — Tool details page is publicly accessible
- **External links use target="_blank"** — Website links open in new tabs with `rel="noopener noreferrer"`
- **No user input except newsletter** — Newsletter signup is UI-only, no backend integration

## Acceptance Criteria

### Visual Match

- [ ] Page layout matches reference design (two-column on desktop, single column on mobile)
- [ ] Dark theme applied correctly with design system tokens
- [ ] Typography hierarchy matches reference (H1, H2, H3 sizes and weights)
- [ ] Spacing and padding match reference (16px, 24px, 32px patterns)
- [ ] Card borders and border-radius match reference (1px solid, 12px radius)
- [ ] Color scheme matches reference (background #080D12, surfaces #1F2937, primary #6366F1)
- [ ] AI Score card displays with gradient bar (green → yellow → red)
- [ ] AI Confidence gauge displays as circular progress (92%)
- [ ] Score Breakdown shows progress bars with correct percentages
- [ ] Source Breakdown shows color-coded legend
- [ ] Quick Actions have external link icons
- [ ] Tool Information displays key-value pairs
- [ ] Newsletter section has email input and subscribe button
- [ ] Footer matches home page footer

### Design-Matching Verification (Required)

- [ ] Step 3 completed: App run and screenshot captured
- [ ] Step 4 completed: AI comparison performed (Matches / Likely matches / Differs)
- [ ] Step 5 completed: Implementation summary with exact values output
- [ ] Step 6 completed: Human review requested with all required materials
- [ ] Step 7 completed: All CEO feedback addressed and re-verified
- [ ] Step 8 completed: Temporary screenshots deleted
- [ ] Final confirmation: CEO approved the implementation matches the reference

### Responsiveness

- [ ] Mobile layout (<768px): Single column, sidebar stacks below main
- [ ] Tablet layout (768-1024px): Single column, sidebar stacks below main
- [ ] Desktop layout (>1024px): Two-column layout (main + 320px sidebar)
- [ ] Hero section stacks vertically on mobile
- [ ] Metadata row shows 2 columns on mobile, 4 on desktop
- [ ] Key Features shows 1 column on mobile, 2 on desktop
- [ ] Pros/Cons shows 1 column on mobile, 2 on desktop
- [ ] Related Tools scroll horizontally on all sizes
- [ ] All text remains readable at all sizes
- [ ] No horizontal overflow on any screen size

### Data Integration

- [ ] Tool data displays correctly from mock data
- [ ] Tool name renders in hero section
- [ ] Tool description renders in hero section
- [ ] Category badge displays correctly
- [ ] Metadata row shows category, company, website, last updated
- [ ] AI Summary renders tool summary text
- [ ] Key Features renders feature list in 2 columns
- [ ] Pros renders with green checkmarks
- [ ] Cons renders with red X marks
- [ ] Best For renders target users as tags
- [ ] Integrations renders integration list with icons
- [ ] Related Tools renders 5 related tools by category
- [ ] 404 page displays when tool ID doesn't exist

### Accessibility

- [ ] All images have alt text
- [ ] Interactive elements are keyboard accessible
- [ ] Focus states are visible
- [ ] Color contrast meets WCAG AA standards
- [ ] Semantic HTML structure (headings, landmarks, lists)

## Checks to Run

After implementation, run these checks and report results:

```bash
# TypeScript check
npm run typecheck

# Lint check
npm run lint

# Build check (if routes changed)
npm run build
```

## Manual Test Steps

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to tool details page:**
   - Open browser to `http://localhost:3000/tools/1`
   - Verify the page loads with Cursor tool data

3. **Visual verification:**
   - Compare with reference image at `ui_ref/details_page.png`
   - Check hero section layout (title, description, score card)
   - Check metadata row (4 cards in a row)
   - Check two-column layout (main content + sidebar)
   - Check all sections render (AI Summary, Key Features, Pros/Cons, etc.)
   - Check sidebar components (Score Breakdown, AI Confidence, Source Breakdown, Quick Actions, Tool Information)

4. **Responsive testing:**
   - Resize browser to mobile width (<768px)
   - Verify single-column layout
   - Verify sidebar stacks below main content
   - Resize to desktop width (>1024px)
   - Verify two-column layout

5. **Navigation testing:**
   - Click "Back to Home" in breadcrumb
   - Click external links (website, documentation, GitHub)
   - Verify links open in new tabs

6. **404 testing:**
   - Navigate to `http://localhost:3000/tools/nonexistent`
   - Verify 404 page displays with "Tool Not Found" message

7. **Newsletter section:**
   - Verify email input is visible
   - Verify subscribe button is visible
   - (No actual submission - UI only)

8. **Check terminal for errors:**
   - Watch the terminal running Next.js dev server
   - Report any errors or warnings

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-07-19 | Initial implementation prompt |
| 1.1 | 2026-07-19 | Added complete design-matching workflow (Steps 3-8) with iterative verification cycle, implementation summary format, and human review process |
