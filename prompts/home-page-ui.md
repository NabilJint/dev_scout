# Home Page UI Implementation Prompt

## Goal

Implement the DevScout AI home page UI that displays developer tools in a discovery/comparison format. The page includes a header with navigation, category filter pills, a responsive grid of tool cards with AI analysis data, and a footer. Data is sourced from a local mock data file (`lib/mock-data.ts`) instead of Supabase for initial development.

## Assigned Specialist Agent(s)

- **Frontend Engineer** — Primary implementer. Builds all page components, layout, and client-side interactions.
- **UI/UX Designer** — Consulted for design system questions, visual hierarchy, and component styling patterns.

## Skills Read

- `frontend-design` — Production-grade frontend interfaces, dark theme patterns, responsive layouts
- `ui-styling` — Tailwind CSS utilities, shadcn/ui component patterns, CSS variables
- `shadcn` — shadcn/ui component installation, usage, and customization
- `node_modules/next/dist/docs/` — Next.js 16 patterns, server/client components, App Router conventions

## Existing Code Inspected

- `app/globals.css` — Design system tokens (colors, typography, spacing, shadows, radius) fully implemented with Tailwind v4 `@theme` blocks
- `app/layout.tsx` — Root layout with Inter font, metadata configured for DevScout AI
- `app/page.tsx` — Current default Next.js template (will be completely replaced)
- `lib/design-system/` — Complete design token modules (colors, typography, spacing, shadows, radius, types)
- `package.json` — Next.js 16, React 19, Tailwind v4, no shadcn/ui installed yet
- `ui_ref/home_page.png` — UI reference image showing the target design

## Decisions and Assumptions

1. **shadcn/ui is not yet installed** — This prompt must first initialize shadcn/ui (`npx shadcn@latest init`) and install required components (Button, Badge, Card, Input) before building UI.
2. **Use mock data, not Supabase** — A local mock data file (`lib/mock-data.ts`) provides 12 sample tools with analysis data. No Supabase clients, types, or query functions are needed for this implementation.
3. **Data fetching is server-side** — The home page is a React Server Component that imports mock data directly. Category filtering uses URL search params (`?category=AI Tools`) and re-renders server-side.
4. **No authentication required for home page** — Clerk auth is not required to view tools. Login/Subscribe buttons are UI-only placeholders (no actual auth flows yet).
5. **Footer is static** — Footer links are hardcoded. Newsletter signup is UI-only (no backend integration).
6. **Tool data may be empty** — The page must handle empty states gracefully (though mock data will have 12 tools).
7. **Dark theme only** — The UI reference shows dark theme. Light mode is not implemented.
8. **Design system tokens are used exclusively** — All colors, spacing, typography, shadows, and radius must use the tokens from `globals.css` and `lib/design-system/`. No hardcoded values.
9. **Responsive breakpoints** — Mobile: <768px (1 column), Tablet: 768-1024px (2 columns), Desktop: >1024px (3 columns).
10. **Category pills are derived from data** — Categories come from distinct `tool_analyses.category` values in mock data, not hardcoded. "All" is always first.

## Files Likely to Change

| File | Action | Description |
|------|--------|-------------|
| `app/page.tsx` | **Rewrite** | Home page server component with data fetching and layout |
| `app/layout.tsx` | **Update** | Add Header and Footer to root layout |
| `components/header.tsx` | **Create** | Site header with logo, navigation, subscribe/login buttons |
| `components/footer.tsx` | **Create** | Site footer with links, newsletter, social icons |
| `components/tool-card.tsx` | **Create** | Individual tool card component (server component) |
| `components/tool-grid.tsx` | **Create** | Responsive grid of tool cards |
| `components/category-filter.tsx` | **Create** | Horizontal scrollable category pill filter (client component) |
| `components/empty-state.tsx` | **Create** | Empty state when no tools are available |
| `lib/mock-data.ts` | **Create** | Mock tool data with 12 sample tools and analysis data |
| `components/ui/button.tsx` | **Create** | shadcn/ui Button component |
| `components/ui/badge.tsx` | **Create** | shadcn/ui Badge component |
| `components/ui/card.tsx` | **Create** | shadcn/ui Card component |
| `components/ui/input.tsx` | **Create** | shadcn/ui Input component |
| `components.json` | **Create** | shadcn/ui configuration file |

## Implementation Requirements

### Phase 1: Project Setup (shadcn/ui + Mock Data)

#### 1.1 Initialize shadcn/ui

Run from project root:
```bash
npx shadcn@latest init
# Select: New York style, Zinc palette, CSS variables: yes
```

Install required components:
```bash
npx shadcn@latest add button badge card input
```

This creates `components.json` and `components/ui/` directory with base components.

#### 1.2 Create Mock Data File

**`lib/mock-data.ts`** — Mock tool data for development:
```typescript
export interface ToolSource {
  id: string
  name: string
  listing_url: string
  logo_url: string | null
  active: boolean
  parser_strategy: string | null
  created_at: string
}

export interface Tool {
  id: string
  source_id: string
  original_url: string
  canonical_url: string
  name: string
  image_url: string
  last_updated: string
  raw_text: string | null
  scraped_at: string
  analyzed_at: string | null
  created_at: string
}

export interface ToolAnalysis {
  id: string
  tool_id: string
  summary: string
  adoption_score: number
  adoption_label: 'early-stage' | 'growing' | 'established'
  tool_rating_label: 'beginner-friendly' | 'balanced' | 'power-user' | 'mixed' | 'unclear'
  beginner_friendly_percentage: number
  balanced_percentage: number
  power_user_percentage: number
  complexity_score: number
  confidence: number
  main_purpose: string
  category: string
  target_users: string
  key_features: string[]
  pros: string[]
  cons: string[]
  pricing_model: 'free' | 'freemium' | 'paid' | 'usage-based' | 'enterprise' | 'unclear'
  integrations: string[]
  best_for: string
  marketing_buzzwords: string[]
  rating_notes: string
  disclaimer: string
  model: string
  embedding: string | null
  created_at: string
}

export interface ToolWithAnalysis extends Tool {
  tool_analyses: ToolAnalysis | null
  tool_sources: ToolSource
}

export const mockTools: ToolWithAnalysis[] = [
  {
    id: '1',
    source_id: 'src-1',
    original_url: 'https://cursor.com',
    canonical_url: 'https://cursor.com',
    name: 'Cursor',
    image_url: 'https://via.placeholder.com/64',
    last_updated: '2026-07-15T10:00:00Z',
    raw_text: null,
    scraped_at: '2026-07-15T10:00:00Z',
    analyzed_at: '2026-07-15T10:00:00Z',
    created_at: '2026-07-15T10:00:00Z',
    tool_analyses: {
      id: 'analysis-1',
      tool_id: '1',
      summary: 'AI-powered code editor that enhances developer productivity with intelligent code completion, generation, and debugging capabilities.',
      adoption_score: 0.85,
      adoption_label: 'established',
      tool_rating_label: 'balanced',
      beginner_friendly_percentage: 40,
      balanced_percentage: 45,
      power_user_percentage: 15,
      complexity_score: -0.25,
      confidence: 0.9,
      main_purpose: 'AI-assisted code editing',
      category: 'AI Tools',
      target_users: 'Developers, engineers, and technical teams',
      key_features: ['AI code completion', 'Code generation', 'Multi-file editing', 'Terminal integration'],
      pros: ['Significant productivity boost', 'Excellent AI integration', 'Familiar VS Code interface'],
      cons: ['Subscription required for advanced features', 'Can be resource-intensive'],
      pricing_model: 'freemium',
      integrations: ['VS Code extensions', 'Git', 'GitHub Copilot'],
      best_for: 'Developers seeking AI-enhanced coding experience',
      marketing_buzzwords: ['AI-powered', 'Intelligent', 'Productivity'],
      rating_notes: 'Strong AI capabilities with familiar interface',
      disclaimer: 'AI features require active subscription',
      model: 'cursor-1.0',
      embedding: null,
      created_at: '2026-07-15T10:00:00Z',
    },
    tool_sources: {
      id: 'src-1',
      name: 'Cursor',
      listing_url: 'https://cursor.com',
      logo_url: null,
      active: true,
      parser_strategy: null,
      created_at: '2026-07-15T10:00:00Z',
    },
  },
  {
    id: '2',
    source_id: 'src-2',
    original_url: 'https://supabase.com',
    canonical_url: 'https://supabase.com',
    name: 'Supabase',
    image_url: 'https://via.placeholder.com/64',
    last_updated: '2026-07-14T10:00:00Z',
    raw_text: null,
    scraped_at: '2026-07-14T10:00:00Z',
    analyzed_at: '2026-07-14T10:00:00Z',
    created_at: '2026-07-14T10:00:00Z',
    tool_analyses: {
      id: 'analysis-2',
      tool_id: '2',
      summary: 'Open source Firebase alternative providing database, authentication, edge functions, and real-time subscriptions.',
      adoption_score: 0.78,
      adoption_label: 'established',
      tool_rating_label: 'balanced',
      beginner_friendly_percentage: 35,
      balanced_percentage: 50,
      power_user_percentage: 15,
      complexity_score: -0.2,
      confidence: 0.88,
      main_purpose: 'Backend-as-a-Service platform',
      category: 'Backend',
      target_users: 'Full-stack developers and startups',
      key_features: ['PostgreSQL database', 'Authentication', 'Edge functions', 'Real-time subscriptions'],
      pros: ['Open source', 'Excellent documentation', 'Generous free tier'],
      cons: ['Can be complex for simple projects', 'Limited enterprise features'],
      pricing_model: 'freemium',
      integrations: ['React', 'Next.js', 'Flutter', 'Vue'],
      best_for: 'Startups and developers needing scalable backend',
      marketing_buzzwords: ['Open source', 'Firebase alternative', 'Real-time'],
      rating_notes: 'Strong community support with excellent documentation',
      disclaimer: 'Enterprise features require paid plan',
      model: 'supabase-2.0',
      embedding: null,
      created_at: '2026-07-14T10:00:00Z',
    },
    tool_sources: {
      id: 'src-2',
      name: 'Supabase',
      listing_url: 'https://supabase.com',
      logo_url: null,
      active: true,
      parser_strategy: null,
      created_at: '2026-07-14T10:00:00Z',
    },
  },
  {
    id: '3',
    source_id: 'src-3',
    original_url: 'https://clerk.com',
    canonical_url: 'https://clerk.com',
    name: 'Clerk',
    image_url: 'https://via.placeholder.com/64',
    last_updated: '2026-07-13T10:00:00Z',
    raw_text: null,
    scraped_at: '2026-07-13T10:00:00Z',
    analyzed_at: '2026-07-13T10:00:00Z',
    created_at: '2026-07-13T10:00:00Z',
    tool_analyses: {
      id: 'analysis-3',
      tool_id: '3',
      summary: 'Complete user management platform with authentication, user profiles, and multi-tenant organizations.',
      adoption_score: 0.72,
      adoption_label: 'growing',
      tool_rating_label: 'beginner-friendly',
      beginner_friendly_percentage: 60,
      balanced_percentage: 30,
      power_user_percentage: 10,
      complexity_score: -0.5,
      confidence: 0.85,
      main_purpose: 'Authentication and user management',
      category: 'Authentication',
      target_users: 'Web and mobile developers',
      key_features: ['Sign-in/Sign-up flows', 'User profiles', 'Multi-tenant organizations', 'Session management'],
      pros: ['Easy integration', 'Beautiful UI components', 'Excellent documentation'],
      cons: ['Vendor lock-in concerns', 'Pricing can be complex'],
      pricing_model: 'freemium',
      integrations: ['React', 'Next.js', 'Remix', 'Firebase'],
      best_for: 'Developers needing快速 authentication setup',
      marketing_buzzwords: ['Complete', 'Beautiful', 'Secure'],
      rating_notes: 'Excellent developer experience with minimal setup',
      disclaimer: 'Pricing scales with monthly active users',
      model: 'clerk-1.0',
      embedding: null,
      created_at: '2026-07-13T10:00:00Z',
    },
    tool_sources: {
      id: 'src-3',
      name: 'Clerk',
      listing_url: 'https://clerk.com',
      logo_url: null,
      active: true,
      parser_strategy: null,
      created_at: '2026-07-13T10:00:00Z',
    },
  },
  {
    id: '4',
    source_id: 'src-4',
    original_url: 'https://vercel.com',
    canonical_url: 'https://vercel.com',
    name: 'Vercel',
    image_url: 'https://via.placeholder.com/64',
    last_updated: '2026-07-12T10:00:00Z',
    raw_text: null,
    scraped_at: '2026-07-12T10:00:00Z',
    analyzed_at: '2026-07-12T10:00:00Z',
    created_at: '2026-07-12T10:00:00Z',
    tool_analyses: {
      id: 'analysis-4',
      tool_id: '4',
      summary: 'Platform for frontend developers providing hosting, serverless functions, and edge network deployment.',
      adoption_score: 0.9,
      adoption_label: 'established',
      tool_rating_label: 'balanced',
      beginner_friendly_percentage: 45,
      balanced_percentage: 40,
      power_user_percentage: 15,
      complexity_score: -0.3,
      confidence: 0.92,
      main_purpose: 'Frontend deployment platform',
      category: 'Deployment',
      target_users: 'Frontend and full-stack developers',
      key_features: ['Instant deployments', 'Serverless functions', 'Edge network', 'Analytics'],
      pros: ['Excellent DX', 'Fast deployments', 'Great Next.js integration'],
      cons: ['Can be expensive at scale', 'Vendor lock-in'],
      pricing_model: 'usage-based',
      integrations: ['Next.js', 'React', 'Vue', 'Svelte'],
      best_for: 'Teams deploying modern web applications',
      marketing_buzzwords: ['Fast', 'Reliable', 'Global'],
      rating_notes: 'Industry standard for Next.js deployments',
      disclaimer: 'Pricing based on bandwidth and serverless usage',
      model: 'vercel-1.0',
      embedding: null,
      created_at: '2026-07-12T10:00:00Z',
    },
    tool_sources: {
      id: 'src-4',
      name: 'Vercel',
      listing_url: 'https://vercel.com',
      logo_url: null,
      active: true,
      parser_strategy: null,
      created_at: '2026-07-12T10:00:00Z',
    },
  },
  {
    id: '5',
    source_id: 'src-5',
    original_url: 'https://resend.com',
    canonical_url: 'https://resend.com',
    name: 'Resend',
    image_url: 'https://via.placeholder.com/64',
    last_updated: '2026-07-11T10:00:00Z',
    raw_text: null,
    scraped_at: '2026-07-11T10:00:00Z',
    analyzed_at: '2026-07-11T10:00:00Z',
    created_at: '2026-07-11T10:00:00Z',
    tool_analyses: {
      id: 'analysis-5',
      tool_id: '5',
      summary: 'Email API for developers with simple integration, templates, and analytics.',
      adoption_score: 0.65,
      adoption_label: 'growing',
      tool_rating_label: 'beginner-friendly',
      beginner_friendly_percentage: 70,
      balanced_percentage: 25,
      power_user_percentage: 5,
      complexity_score: -0.65,
      confidence: 0.82,
      main_purpose: 'Email delivery API',
      category: 'Email',
      target_users: 'Developers and product teams',
      key_features: ['Email API', 'Templates', 'Analytics', 'Webhooks'],
      pros: ['Simple API', 'Great documentation', 'Fast delivery'],
      cons: ['Limited free tier', 'No drag-and-drop editor'],
      pricing_model: 'usage-based',
      integrations: ['React', 'Next.js', 'Node.js', 'Python'],
      best_for: 'Developers needing transactional email',
      marketing_buzzwords: ['Simple', 'Fast', 'Developer-first'],
      rating_notes: 'Excellent for transactional email needs',
      disclaimer: 'Pricing based on email volume',
      model: 'resend-1.0',
      embedding: null,
      created_at: '2026-07-11T10:00:00Z',
    },
    tool_sources: {
      id: 'src-5',
      name: 'Resend',
      listing_url: 'https://resend.com',
      logo_url: null,
      active: true,
      parser_strategy: null,
      created_at: '2026-07-11T10:00:00Z',
    },
  },
  {
    id: '6',
    source_id: 'src-6',
    original_url: 'https://neon.tech',
    canonical_url: 'https://neon.tech',
    name: 'Neon',
    image_url: 'https://via.placeholder.com/64',
    last_updated: '2026-07-10T10:00:00Z',
    raw_text: null,
    scraped_at: '2026-07-10T10:00:00Z',
    analyzed_at: '2026-07-10T10:00:00Z',
    created_at: '2026-07-10T10:00:00Z',
    tool_analyses: {
      id: 'analysis-6',
      tool_id: '6',
      summary: 'Serverless Postgres with branching, autoscaling, and generous free tier.',
      adoption_score: 0.7,
      adoption_label: 'growing',
      tool_rating_label: 'balanced',
      beginner_friendly_percentage: 45,
      balanced_percentage: 40,
      power_user_percentage: 15,
      complexity_score: -0.3,
      confidence: 0.84,
      main_purpose: 'Serverless PostgreSQL database',
      category: 'Database',
      target_users: 'Full-stack developers and startups',
      key_features: ['Serverless Postgres', 'Database branching', 'Autoscaling', 'Generous free tier'],
      pros: ['Innovative branching', 'Great free tier', 'Fast cold starts'],
      cons: ['Newer platform', 'Limited enterprise features'],
      pricing_model: 'freemium',
      integrations: ['Prisma', 'TypeORM', 'Drizzle', 'Next.js'],
      best_for: 'Developers wanting serverless PostgreSQL',
      marketing_buzzwords: ['Serverless', 'Branching', 'Autoscaling'],
      rating_notes: 'Innovative approach to serverless databases',
      disclaimer: 'Enterprise features in development',
      model: 'neon-1.0',
      embedding: null,
      created_at: '2026-07-10T10:00:00Z',
    },
    tool_sources: {
      id: 'src-6',
      name: 'Neon',
      listing_url: 'https://neon.tech',
      logo_url: null,
      active: true,
      parser_strategy: null,
      created_at: '2026-07-10T10:00:00Z',
    },
  },
  {
    id: '7',
    source_id: 'src-7',
    original_url: 'https://sentry.io',
    canonical_url: 'https://sentry.io',
    name: 'Sentry',
    image_url: 'https://via.placeholder.com/64',
    last_updated: '2026-07-09T10:00:00Z',
    raw_text: null,
    scraped_at: '2026-07-09T10:00:00Z',
    analyzed_at: '2026-07-09T10:00:00Z',
    created_at: '2026-07-09T10:00:00Z',
    tool_analyses: {
      id: 'analysis-7',
      tool_id: '7',
      summary: 'Error tracking and performance monitoring platform for developers.',
      adoption_score: 0.82,
      adoption_label: 'established',
      tool_rating_label: 'power-user',
      beginner_friendly_percentage: 20,
      balanced_percentage: 35,
      power_user_percentage: 45,
      complexity_score: 0.25,
      confidence: 0.87,
      main_purpose: 'Error tracking and monitoring',
      category: 'Monitoring',
      target_users: 'Development teams and DevOps',
      key_features: ['Error tracking', 'Performance monitoring', 'Release tracking', 'Alerts'],
      pros: ['Comprehensive error tracking', 'Multi-platform support', 'Great integrations'],
      cons: ['Can be overwhelming for small projects', 'Pricing complexity'],
      pricing_model: 'freemium',
      integrations: ['React', 'Next.js', 'Node.js', 'Python', 'Ruby'],
      best_for: 'Teams needing production error monitoring',
      marketing_buzzwords: ['Track', 'Monitor', 'Resolve'],
      rating_notes: 'Industry standard for error tracking',
      disclaimer: 'Advanced features require paid plans',
      model: 'sentry-2.0',
      embedding: null,
      created_at: '2026-07-09T10:00:00Z',
    },
    tool_sources: {
      id: 'src-7',
      name: 'Sentry',
      listing_url: 'https://sentry.io',
      logo_url: null,
      active: true,
      parser_strategy: null,
      created_at: '2026-07-09T10:00:00Z',
    },
  },
  {
    id: '8',
    source_id: 'src-8',
    original_url: 'https://convex.dev',
    canonical_url: 'https://convex.dev',
    name: 'Convex',
    image_url: 'https://via.placeholder.com/64',
    last_updated: '2026-07-08T10:00:00Z',
    raw_text: null,
    scraped_at: '2026-07-08T10:00:00Z',
    analyzed_at: '2026-07-08T10:00:00Z',
    created_at: '2026-07-08T10:00:00Z',
    tool_analyses: {
      id: 'analysis-8',
      tool_id: '8',
      summary: 'Full-stack backend platform with real-time database, serverless functions, and file storage.',
      adoption_score: 0.55,
      adoption_label: 'growing',
      tool_rating_label: 'balanced',
      beginner_friendly_percentage: 40,
      balanced_percentage: 45,
      power_user_percentage: 15,
      complexity_score: -0.25,
      confidence: 0.8,
      main_purpose: 'Full-stack backend platform',
      category: 'Backend',
      target_users: 'Full-stack developers',
      key_features: ['Real-time database', 'Serverless functions', 'File storage', 'Authentication'],
      pros: ['All-in-one solution', 'Real-time capabilities', 'Great developer experience'],
      cons: ['Newer platform', 'Limited ecosystem'],
      pricing_model: 'freemium',
      integrations: ['React', 'Next.js', 'TypeScript'],
      best_for: 'Developers wanting integrated backend',
      marketing_buzzwords: ['Full-stack', 'Real-time', 'Integrated'],
      rating_notes: 'Promising all-in-one backend solution',
      disclaimer: 'Still building out enterprise features',
      model: 'convex-1.0',
      embedding: null,
      created_at: '2026-07-08T10:00:00Z',
    },
    tool_sources: {
      id: 'src-8',
      name: 'Convex',
      listing_url: 'https://convex.dev',
      logo_url: null,
      active: true,
      parser_strategy: null,
      created_at: '2026-07-08T10:00:00Z',
    },
  },
  {
    id: '9',
    source_id: 'src-9',
    original_url: 'https://prisma.io',
    canonical_url: 'https://prisma.io',
    name: 'Prisma',
    image_url: 'https://via.placeholder.com/64',
    last_updated: '2026-07-07T10:00:00Z',
    raw_text: null,
    scraped_at: '2026-07-07T10:00:00Z',
    analyzed_at: '2026-07-07T10:00:00Z',
    created_at: '2026-07-07T10:00:00Z',
    tool_analyses: {
      id: 'analysis-9',
      tool_id: '9',
      summary: 'Next-generation ORM for Node.js and TypeScript with type-safe database access.',
      adoption_score: 0.75,
      adoption_label: 'established',
      tool_rating_label: 'balanced',
      beginner_friendly_percentage: 35,
      balanced_percentage: 50,
      power_user_percentage: 15,
      complexity_score: -0.2,
      confidence: 0.86,
      main_purpose: 'Database ORM for Node.js',
      category: 'ORM',
      target_users: 'Backend and full-stack developers',
      key_features: ['Type-safe queries', 'Database migrations', 'Studio GUI', 'Prisma Client'],
      pros: ['Excellent type safety', 'Great documentation', 'Active community'],
      cons: ['Learning curve for complex queries', 'Migration complexity'],
      pricing_model: 'free',
      integrations: ['PostgreSQL', 'MySQL', 'SQLite', 'MongoDB'],
      best_for: 'Developers wanting type-safe database access',
      marketing_buzzwords: ['Type-safe', 'Next-gen', 'Developer experience'],
      rating_notes: 'Excellent choice for TypeScript projects',
      disclaimer: 'Open source with commercial support available',
      model: 'prisma-5.0',
      embedding: null,
      created_at: '2026-07-07T10:00:00Z',
    },
    tool_sources: {
      id: 'src-9',
      name: 'Prisma',
      listing_url: 'https://prisma.io',
      logo_url: null,
      active: true,
      parser_strategy: null,
      created_at: '2026-07-07T10:00:00Z',
    },
  },
  {
    id: '10',
    source_id: 'src-10',
    original_url: 'https://planetscale.com',
    canonical_url: 'https://planetscale.com',
    name: 'PlanetScale',
    image_url: 'https://via.placeholder.com/64',
    last_updated: '2026-07-06T10:00:00Z',
    raw_text: null,
    scraped_at: '2026-07-06T10:00:00Z',
    analyzed_at: '2026-07-06T10:00:00Z',
    created_at: '2026-07-06T10:00:00Z',
    tool_analyses: {
      id: 'analysis-10',
      tool_id: '10',
      summary: 'MySQL-compatible serverless database platform with branching and non-blocking schema changes.',
      adoption_score: 0.68,
      adoption_label: 'growing',
      tool_rating_label: 'power-user',
      beginner_friendly_percentage: 25,
      balanced_percentage: 40,
      power_user_percentage: 35,
      complexity_score: 0.1,
      confidence: 0.83,
      main_purpose: 'Serverless MySQL database',
      category: 'Database',
      target_users: 'Backend developers and DBAs',
      key_features: ['MySQL compatible', 'Database branching', 'Non-blocking changes', 'Connection pooling'],
      pros: ['Innovative schema management', 'Great performance', 'Developer-friendly'],
      cons: ['MySQL only', 'Pricing can be complex'],
      pricing_model: 'usage-based',
      integrations: ['Prisma', 'TypeORM', 'Sequelize', 'Next.js'],
      best_for: 'Teams needing scalable MySQL databases',
      marketing_buzzwords: ['Serverless', 'Branching', 'Non-blocking'],
      rating_notes: 'Excellent for teams with MySQL expertise',
      disclaimer: 'Pricing based on storage and queries',
      model: 'planetscale-1.0',
      embedding: null,
      created_at: '2026-07-06T10:00:00Z',
    },
    tool_sources: {
      id: 'src-10',
      name: 'PlanetScale',
      listing_url: 'https://planetscale.com',
      logo_url: null,
      active: true,
      parser_strategy: null,
      created_at: '2026-07-06T10:00:00Z',
    },
  },
  {
    id: '11',
    source_id: 'src-11',
    original_url: 'https://railway.app',
    canonical_url: 'https://railway.app',
    name: 'Railway',
    image_url: 'https://via.placeholder.com/64',
    last_updated: '2026-07-05T10:00:00Z',
    raw_text: null,
    scraped_at: '2026-07-05T10:00:00Z',
    analyzed_at: '2026-07-05T10:00:00Z',
    created_at: '2026-07-05T10:00:00Z',
    tool_analyses: {
      id: 'analysis-11',
      tool_id: '11',
      summary: 'Infrastructure platform for deploying apps, databases, and services with zero configuration.',
      adoption_score: 0.6,
      adoption_label: 'growing',
      tool_rating_label: 'beginner-friendly',
      beginner_friendly_percentage: 65,
      balanced_percentage: 30,
      power_user_percentage: 5,
      complexity_score: -0.6,
      confidence: 0.81,
      main_value: 'Zero-config deployment',
      category: 'DevOps',
      target_users: 'Solo developers and small teams',
      key_features: ['Zero config deployment', 'Managed databases', 'Instant deploys', 'GitHub integration'],
      pros: ['Extremely easy to use', 'Fast deployments', 'Generous free tier'],
      cons: ['Limited customization', 'Smaller ecosystem'],
      pricing_model: 'usage-based',
      integrations: ['GitHub', 'Docker', 'PostgreSQL', 'Redis'],
      best_for: 'Developers wanting simple deployment',
      marketing_buzzwords: ['Zero config', 'Instant', 'Simple'],
      rating_notes: 'Great for rapid prototyping and small projects',
      disclaimer: 'Pricing based on resource usage',
      model: 'railway-1.0',
      embedding: null,
      created_at: '2026-07-05T10:00:00Z',
    },
    tool_sources: {
      id: 'src-11',
      name: 'Railway',
      listing_url: 'https://railway.app',
      logo_url: null,
      active: true,
      parser_strategy: null,
      created_at: '2026-07-05T10:00:00Z',
    },
  },
  {
    id: '12',
    source_id: 'src-12',
    original_url: 'https://cloudflare.com',
    canonical_url: 'https://cloudflare.com',
    name: 'Cloudflare',
    image_url: 'https://via.placeholder.com/64',
    last_updated: '2026-07-04T10:00:00Z',
    raw_text: null,
    scraped_at: '2026-07-04T10:00:00Z',
    analyzed_at: '2026-07-04T10:00:00Z',
    created_at: '2026-07-04T10:00:00Z',
    tool_analyses: {
      id: 'analysis-12',
      tool_id: '12',
      summary: 'Cloud platform providing CDN, security, serverless computing, and developer tools.',
      adoption_score: 0.88,
      adoption_label: 'established',
      tool_rating_label: 'power-user',
      beginner_friendly_percentage: 15,
      balanced_percentage: 35,
      power_user_percentage: 50,
      complexity_score: 0.35,
      confidence: 0.89,
      main_purpose: 'Cloud infrastructure platform',
      category: 'Cloud',
      target_users: 'DevOps engineers and infrastructure teams',
      key_features: ['CDN', 'DDoS protection', 'Workers', 'R2 storage'],
      pros: ['Global network', 'Competitive pricing', 'Strong security'],
      cons: ['Complex product suite', 'Learning curve'],
      pricing_model: 'freemium',
      integrations: ['Next.js', 'React', 'Docker', 'Kubernetes'],
      best_for: 'Teams needing global cloud infrastructure',
      marketing_buzzwords: ['Global', 'Secure', 'Fast'],
      rating_notes: 'Comprehensive cloud platform with global reach',
      disclaimer: 'Enterprise features require custom pricing',
      model: 'cloudflare-1.0',
      embedding: null,
      created_at: '2026-07-04T10:00:00Z',
    },
    tool_sources: {
      id: 'src-12',
      name: 'Cloudflare',
      listing_url: 'https://cloudflare.com',
      logo_url: null,
      active: true,
      parser_strategy: null,
      created_at: '2026-07-04T10:00:00Z',
    },
  },
]

export function getTools(category?: string): ToolWithAnalysis[] {
  let tools = mockTools.filter(tool => tool.analyzed_at && tool.tool_analyses)

  if (category && category !== 'All') {
    tools = tools.filter(tool => tool.tool_analyses?.category === category)
  }

  return tools.sort((a, b) => 
    new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
  )
}

export function getCategories(): string[] {
  const categories = mockTools
    .map(tool => tool.tool_analyses?.category)
    .filter((category): category is string => Boolean(category))
  
  const uniqueCategories = [...new Set(categories)]
  return ['All', ...uniqueCategories.sort()]
}
```

### Phase 2: Component Implementation

#### 2.1 Header Component

**`components/header.tsx`** — Server component:
```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function Header() {
  return (
    <header className="sticky top-0 z-sticky border-b border-border-subtle bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-grid-container items-center justify-between px-grid-margin">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-white">DS</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-text-primary">DevScout AI</span>
            <span className="text-xs text-text-muted">Developer Tools Discovery Platform</span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm font-medium text-text-primary hover:text-primary">Home</Link>
          <Link href="/categories" className="text-sm font-medium text-text-secondary hover:text-primary">Categories</Link>
          <Link href="/collections" className="text-sm font-medium text-text-secondary hover:text-primary">Collections</Link>
          <Link href="/resources" className="text-sm font-medium text-text-secondary hover:text-primary">Resources</Link>
          <Link href="/for-you" className="flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-primary">
            For You
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-white">New</span>
          </Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button variant="primary" size="sm">Subscribe</Button>
          <Button variant="secondary" size="sm">Login</Button>
        </div>
      </div>
    </header>
  )
}
```

#### 2.2 Footer Component

**`components/footer.tsx`** — Server component:
```tsx
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const companyLinks = [
  { label: 'About', href: '/about' },
  { label: 'Careers', href: '/careers' },
  { label: 'Press', href: '/press' },
  { label: 'Contact', href: '/contact' },
]

const resourceLinks = [
  { label: 'Blog', href: '/blog' },
  { label: 'Guides', href: '/guides' },
  { label: 'API', href: '/api' },
  { label: 'Changelog', href: '/changelog' },
]

const legalLinks = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Cookie Policy', href: '/cookies' },
  { label: 'License', href: '/license' },
]

export function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-surface">
      <div className="mx-auto max-w-grid-container px-grid-margin py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-bold text-white">DS</span>
              </div>
              <span className="text-sm font-semibold text-text-primary">DevScout AI</span>
            </div>
            <p className="mt-3 text-sm text-text-secondary">
              Discover, analyze, and compare the best developer tools with AI-powered insights.
            </p>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-text-primary">Company</h4>
            <ul className="space-y-2">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-text-secondary hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resource Links */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-text-primary">Resources</h4>
            <ul className="space-y-2">
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-text-secondary hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-text-primary">Stay Updated</h4>
            <p className="mb-3 text-sm text-text-secondary">
              Get the latest developer tools delivered to your inbox.
            </p>
            <div className="flex gap-2">
              <Input type="email" placeholder="Enter your email" className="flex-1" />
              <Button variant="primary" size="sm">Subscribe</Button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border-subtle pt-8 md:flex-row">
          <div className="flex gap-4">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-xs text-text-muted hover:text-text-secondary">
                {link.label}
              </Link>
            ))}
          </div>
          <p className="text-xs text-text-muted">
            © {new Date().getFullYear()} DevScout AI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
```

#### 2.3 Tool Card Component

**`components/tool-card.tsx`** — Server component:
```tsx
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import type { ToolWithAnalysis } from '@/lib/mock-data'

interface ToolCardProps {
  tool: ToolWithAnalysis
}

export function ToolCard({ tool }: ToolCardProps) {
  const analysis = tool.tool_analyses
  const source = tool.tool_sources

  // Format time ago
  const timeAgo = formatTimeAgo(tool.last_updated)

  // Rating colors
  const excellentColor = 'bg-positive'
  const averageColor = 'bg-warning'
  const poorColor = 'bg-negative'

  return (
    <article className="group relative flex flex-col rounded-xl border border-border-subtle bg-surface-elevated p-5 transition-all hover:border-border-default hover:shadow-lg">
      {/* Category Badge + Info Icon */}
      <div className="mb-4 flex items-center justify-between">
        <Badge variant="primary">{analysis?.category || 'Uncategorized'}</Badge>
        <button className="text-text-muted hover:text-text-secondary" aria-label="More info">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 7v4M8 5.5v0" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Tool Logo */}
      <div className="mb-4 flex h-16 items-center justify-center">
        <Image
          src={tool.image_url}
          alt={`${tool.name} logo`}
          width={64}
          height={64}
          className="h-16 w-16 rounded-xl object-contain"
          unoptimized
        />
      </div>

      {/* Tool Name + Subtitle */}
      <h3 className="mb-1 text-center text-base font-semibold text-text-primary">
        {tool.name}
      </h3>
      <p className="mb-2 text-center text-xs text-text-muted">
        {source.name}
      </p>

      {/* Description */}
      <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-text-secondary">
        {analysis?.summary || 'No description available.'}
      </p>

      {/* Rating Bars */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-16 text-xs text-text-secondary">Excellent</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-n-700">
            <div
              className={`h-full rounded-full ${excellentColor}`}
              style={{ width: `${analysis?.beginner_friendly_percentage || 0}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs text-text-muted">
            {analysis?.beginner_friendly_percentage || 0}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 text-xs text-text-secondary">Average</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-n-700">
            <div
              className={`h-full rounded-full ${averageColor}`}
              style={{ width: `${analysis?.balanced_percentage || 0}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs text-text-muted">
            {analysis?.balanced_percentage || 0}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 text-xs text-text-secondary">Poor</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-n-700">
            <div
              className={`h-full rounded-full ${poorColor}`}
              style={{ width: `${analysis?.power_user_percentage || 0}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs text-text-muted">
            {analysis?.power_user_percentage || 0}%
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-border-subtle pt-3">
        <span className="text-xs text-text-muted">1 sources</span>
        <span className="text-xs text-text-muted">Updated {timeAgo}</span>
      </div>
    </article>
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

#### 2.4 Category Filter Component

**`components/category-filter.tsx`** — Client component:
```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

interface CategoryFilterProps {
  categories: string[]
  activeCategory: string
}

export function CategoryFilter({ categories, activeCategory }: CategoryFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleCategoryClick(category: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (category === 'All') {
      params.delete('category')
    } else {
      params.set('category', category)
    }
    router.push(`/?${params.toString()}`)
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => handleCategoryClick(category)}
          className="flex-shrink-0"
        >
          <Badge
            variant={activeCategory === category ? 'primary' : 'default'}
            className="cursor-pointer transition-colors hover:bg-primary/20"
          >
            {category}
          </Badge>
        </button>
      ))}
    </div>
  )
}
```

#### 2.5 Empty State Component

**`components/empty-state.tsx`**:
```tsx
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-elevated">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
          <path d="M4 8h24M4 16h24M4 24h24" strokeLinecap="round" />
          <circle cx="8" cy="8" r="2" fill="currentColor" />
          <circle cx="16" cy="16" r="2" fill="currentColor" />
          <circle cx="24" cy="24" r="2" fill="currentColor" />
        </svg>
      </div>
      <h3 className="mb-2 text-lg font-semibold text-text-primary">No tools found</h3>
      <p className="max-w-md text-sm text-text-secondary">
        There are no developer tools available yet. Check back later or try a different category.
      </p>
    </div>
  )
}
```

#### 2.6 Tool Grid Component

**`components/tool-grid.tsx`** — Server component:
```tsx
import { ToolCard } from '@/components/tool-card'
import type { ToolWithAnalysis } from '@/lib/mock-data'

interface ToolGridProps {
  tools: ToolWithAnalysis[]
}

export function ToolGrid({ tools }: ToolGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  )
}
```

### Phase 3: Home Page Assembly

#### 3.1 Home Page

**`app/page.tsx`** — Server component:
```tsx
import Link from 'next/link'
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

  // Fetch data from mock data (synchronous)
  const tools = getTools(category === 'All' ? undefined : category)
  const categories = getCategories()

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero Section */}
      <section className="border-b border-border-subtle bg-surface py-12">
        <div className="mx-auto max-w-grid-container px-grid-margin">
          <h1 className="mb-2 text-3xl font-bold text-text-primary">Top Developer Tools</h1>
          <p className="mb-6 text-text-secondary">
            Discover, analyze, and compare the best developer tools with AI-powered insights.
          </p>

          {/* Category Filter */}
          <Suspense fallback={<div className="h-8" />}>
            <CategoryFilter categories={categories} activeCategory={category} />
          </Suspense>
        </div>
      </section>

      {/* Main Content */}
      <section className="flex-1 py-8">
        <div className="mx-auto max-w-grid-container px-grid-margin">
          {/* Section Header */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text-primary">
              {category === 'All' ? 'All Tools' : category}
            </h2>
            <Link
              href="/tools"
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              View All Tools →
            </Link>
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

#### 3.2 Layout Update

**`app/layout.tsx`** — Add Header and Footer:
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DevScout AI — Developer Tools Discovery Platform",
  description: "Discover, analyze, and compare the best developer tools with AI-powered insights.",
  keywords: ["developer tools", "AI", "code editor", "backend", "frontend", "DevOps"],
  openGraph: {
    title: "DevScout AI",
    description: "Developer Tools Discovery Platform",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-text-primary font-primary">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

### Visual Interpretation, Layout, Typography, Spacing, Colors, Responsiveness

#### Visual Interpretation (from UI Reference)

The home page follows a dark-themed developer tools discovery layout:

- **Background**: Very dark blue-black (#080D12) with slightly elevated surfaces (#111827)
- **Cards**: Elevated surface (#1F2937) with subtle borders (#374151)
- **Primary accent**: Indigo/purple (#6366F1) for buttons, badges, and interactive elements
- **Text hierarchy**: Primary (#F9FAFB) for headings, Secondary (#9CA3AF) for body, Muted (#6B7280) for metadata
- **Rating bars**: Green (#10B981) for excellent, Yellow (#F59E0B) for average, Red (#EF4444) for poor

#### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ Header (sticky, blur backdrop)                         │
│ [Logo] [Nav Links] [Subscribe] [Login]                 │
├─────────────────────────────────────────────────────────┤
│ Hero Section                                            │
│ [Title] [Subtitle]                                     │
│ [Category Pills: All | AI Tools | Backend | ...]       │
├─────────────────────────────────────────────────────────┤
│ Main Content                                            │
│ [Section Title]                    [View All Tools →]  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│ │ Tool Card│ │ Tool Card│ │ Tool Card│                │
│ │ ...      │ │ ...      │ │ ...      │                │
│ └──────────┘ └──────────┘ └──────────┘                │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│ │ Tool Card│ │ Tool Card│ │ Tool Card│                │
│ └──────────┘ └──────────┘ └──────────┘                │
├─────────────────────────────────────────────────────────┤
│ Footer                                                  │
│ [Logo] [Company Links] [Resources] [Newsletter]        │
│ [Legal Links]                          [Copyright]     │
└─────────────────────────────────────────────────────────┘
```

#### Typography

- **H1**: 2rem (32px), font-weight 700, line-height 1.2
- **H2**: 1.5rem (24px), font-weight 600, line-height 1.3
- **H3 (Card Title)**: 1rem (16px), font-weight 600, line-height 1.3
- **Body**: 0.875rem (14px), font-weight 400, line-height 1.6
- **Caption**: 0.6875rem (11px), font-weight 400, line-height 1.4
- **Font Family**: Inter (system-ui fallback)

#### Spacing

- **Page padding**: 1.5rem (24px) horizontal — `px-grid-margin`
- **Card padding**: 1.25rem (20px) — `p-5`
- **Section spacing**: 2rem (32px) vertical — `py-8`
- **Grid gap**: 1.5rem (24px) — `gap-6`
- **Card internal spacing**: 1rem (16px) between elements — `mb-4`

#### Responsiveness

| Breakpoint | Grid Columns | Card Width | Navigation |
|------------|--------------|------------|------------|
| Mobile (<768px) | 1 | Full width | Hamburger (hidden) |
| Tablet (768-1024px) | 2 | ~50% | Horizontal |
| Desktop (>1024px) | 3 | ~33% | Horizontal |

- **Category pills**: Horizontal scroll on mobile, wrap on desktop
- **Header**: Logo + actions always visible, nav links hidden on mobile
- **Footer**: Single column on mobile, 4-column grid on desktop

#### Pixel-Perfect Expectations

- Card border-radius: 12px (`rounded-xl`)
- Card border: 1px solid #374151 (`border-border-subtle`)
- Card hover: border changes to #6B7280 (`border-border-default`), shadow increases
- Badge border-radius: 9999px (`rounded-full`)
- Rating bar height: 6px (`h-1.5`)
- Rating bar border-radius: 9999px (`rounded-full`)
- Tool logo: 64x64px with 12px border-radius
- Info icon: 16x16px, stroke-width 1.5

## Security Requirements

- **No secrets in client code** — Mock data is local and requires no credentials
- **No API calls from client** — All data fetching is server-side in React Server Components
- **No authentication required** — Home page is public, no Clerk integration needed yet
- **Input validation** — Category filter uses URL search params, sanitized by Next.js

## Acceptance Criteria

- [ ] Header displays logo, navigation links, Subscribe and Login buttons
- [ ] Header is sticky with blur backdrop on scroll
- [ ] Category filter shows all unique categories from mock data with "All" selected by default
- [ ] Category filter updates URL search params and filters tools
- [ ] Tool grid displays 3 columns on desktop, 2 on tablet, 1 on mobile
- [ ] Each tool card shows: category badge, info icon, logo, name, source, summary, rating bars, sources count, time ago
- [ ] Rating bars display correct percentages with green/yellow/red colors
- [ ] Empty state displays when no tools are available
- [ ] Footer displays company links, resource links, newsletter signup, legal links, copyright
- [ ] All colors use design system tokens (no hardcoded values)
- [ ] Responsive design works on mobile (375px), tablet (768px), desktop (1280px+)
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Build succeeds

## Checks to Run

After implementation, run these checks and report results:

```bash
# TypeScript check
npm run typecheck

# ESLint check
npm run lint

# Production build
npm run build
```

## Manual Test Steps

1. **Start dev server**: `npm run dev`
2. **Open browser**: Navigate to `http://localhost:3000`
3. **Verify header**: Logo "DevScout AI", navigation links, Subscribe/Login buttons visible
4. **Verify header sticky**: Scroll down, header should remain visible with blur backdrop
5. **Verify category pills**: "All" selected by default, clicking a pill updates URL and filters tools
6. **Verify tool grid**: 3 columns on desktop, cards display tool info correctly
7. **Verify tool card content**: Each card shows category, logo, name, source, summary, rating bars
8. **Verify rating bars**: Green (excellent), yellow (average), red (poor) with correct percentages
9. **Verify empty state**: If no tools in database, show "No tools found" message
10. **Verify footer**: Company links, resources, newsletter input, legal links, copyright
11. **Verify responsive**: Resize browser to mobile width, verify 1-column layout
12. **Verify dark theme**: Background #080D12, cards #1F2937, text #F9FAFB
13. **Verify mock data**: All 12 tools should be displayed (Cursor, Supabase, Clerk, Vercel, Resend, Neon, Sentry, Convex, Prisma, PlanetScale, Railway, Cloudflare)

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-18 | Prompt Engineer | Initial home page UI implementation prompt |
| 1.1 | 2026-07-18 | Prompt Engineer | Updated to use mock data instead of Supabase for initial development |
