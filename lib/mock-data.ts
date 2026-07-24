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
  brand_text: string | null
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
  subtitle: string
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

// Fixed timestamps for top-3 tools so sort order is deterministic (Cursor > Supabase > Clerk)
// Compute once at module init so all 3 share the same value
const NOW = Date.now()
const TOP_UPDATED = new Date(NOW - 2 * 60 * 60 * 1000).toISOString()

export const mockTools: ToolWithAnalysis[] = [
  {
    id: '3',
    source_id: 'src-3',
    original_url: 'https://clerk.com',
    canonical_url: 'https://clerk.com',
    name: 'Clerk',
    brand_text: null,
    image_url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#f97316"/><text x="24" y="32" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="24" fill="#fff">C</text></svg>'),
    last_updated: TOP_UPDATED,
    raw_text: null,
    scraped_at: '2026-07-13T10:00:00Z',
    analyzed_at: '2026-07-13T10:00:00Z',
    created_at: '2026-07-13T10:00:00Z',
    tool_analyses: {
      id: 'analysis-3',
      tool_id: '3',
      summary: 'Add sign-in, sign-up and user management to your app in minutes.',
      adoption_score: 0.72,
      adoption_label: 'growing',
      tool_rating_label: 'beginner-friendly',
      beginner_friendly_percentage: 30,
      balanced_percentage: 45,
      power_user_percentage: 25,
      complexity_score: -0.05,
      confidence: 0.85,
      main_purpose: 'Authentication and user management',
      category: 'Authentication',
      subtitle: 'Authentication Platform',
      target_users: 'Web and mobile developers',
      key_features: ['Sign-in/Sign-up flows', 'User profiles', 'Multi-tenant organizations', 'Session management'],
      pros: ['Easy integration', 'Beautiful UI components', 'Excellent documentation'],
      cons: ['Vendor lock-in concerns', 'Pricing can be complex'],
      pricing_model: 'freemium',
      integrations: ['React', 'Next.js', 'Remix', 'Firebase'],
      best_for: 'Developers needing quick authentication setup',
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
    id: '2',
    source_id: 'src-2',
    original_url: 'https://supabase.com',
    canonical_url: 'https://supabase.com',
    name: 'Supabase',
    brand_text: null,
    image_url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#1c1c1c"/><text x="24" y="32" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="24" fill="#3ecf8e">S</text></svg>'),
    last_updated: TOP_UPDATED,
    raw_text: null,
    scraped_at: '2026-07-14T10:00:00Z',
    analyzed_at: '2026-07-14T10:00:00Z',
    created_at: '2026-07-14T10:00:00Z',
    tool_analyses: {
      id: 'analysis-2',
      tool_id: '2',
      summary: 'Build and scale your app with a Postgres DB, Auth, Storage, and real-time APIs.',
      adoption_score: 0.78,
      adoption_label: 'established',
      tool_rating_label: 'balanced',
      beginner_friendly_percentage: 28,
      balanced_percentage: 47,
      power_user_percentage: 25,
      complexity_score: -0.03,
      confidence: 0.88,
      main_purpose: 'Backend-as-a-Service platform',
      category: 'Backend',
      subtitle: 'Open Source Backend',
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
    id: '1',
    source_id: 'src-1',
    original_url: 'https://cursor.com',
    canonical_url: 'https://cursor.com',
    name: 'Cursor',
    brand_text: null,
    image_url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#000"/><text x="24" y="32" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="28" fill="#a78bfa">&gt;</text></svg>'),
    last_updated: TOP_UPDATED,
    raw_text: null,
    scraped_at: '2026-07-15T10:00:00Z',
    analyzed_at: '2026-07-15T10:00:00Z',
    created_at: '2026-07-15T10:00:00Z',
    tool_analyses: {
      id: 'analysis-1',
      tool_id: '1',
      summary: 'The AI-first code editor that helps you build faster with intelligent autocomplete.',
      adoption_score: 0.85,
      adoption_label: 'established',
      tool_rating_label: 'balanced',
      beginner_friendly_percentage: 25,
      balanced_percentage: 50,
      power_user_percentage: 25,
      complexity_score: 0,
      confidence: 0.9,
      main_purpose: 'AI-assisted code editing',
      category: 'AI Coding',
      subtitle: 'AI Code Editor',
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
    id: '4',
    source_id: 'src-4',
    original_url: 'https://vercel.com',
    canonical_url: 'https://vercel.com',
    name: 'Vercel',
    brand_text: 'Vercel',
    image_url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#000"/><text x="24" y="32" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="24" fill="#fff">V</text></svg>'),
    last_updated: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    raw_text: null,
    scraped_at: '2026-07-12T10:00:00Z',
    analyzed_at: '2026-07-12T10:00:00Z',
    created_at: '2026-07-12T10:00:00Z',
    tool_analyses: {
      id: 'analysis-4',
      tool_id: '4',
      summary: 'The platform for frontend frameworks and static sites. Built for speed.',
      adoption_score: 0.9,
      adoption_label: 'established',
      tool_rating_label: 'balanced',
      beginner_friendly_percentage: 32,
      balanced_percentage: 45,
      power_user_percentage: 23,
      complexity_score: -0.09,
      confidence: 0.92,
      main_purpose: 'Frontend deployment platform',
      category: 'Deployment',
      subtitle: 'Deployment Platform',
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
    brand_text: 'Resend',
    image_url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#000"/><text x="24" y="32" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="24" fill="#fff">R</text></svg>'),
    last_updated: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    raw_text: null,
    scraped_at: '2026-07-11T10:00:00Z',
    analyzed_at: '2026-07-11T10:00:00Z',
    created_at: '2026-07-11T10:00:00Z',
    tool_analyses: {
      id: 'analysis-5',
      tool_id: '5',
      summary: 'The best way to reach your users with reliable and developer-friendly email.',
      adoption_score: 0.65,
      adoption_label: 'growing',
      tool_rating_label: 'beginner-friendly',
      beginner_friendly_percentage: 26,
      balanced_percentage: 49,
      power_user_percentage: 25,
      complexity_score: -0.01,
      confidence: 0.82,
      main_purpose: 'Email delivery API',
      category: 'Email',
      subtitle: 'Email API',
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
    brand_text: 'NEON',
    image_url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#0c0c0c"/><text x="24" y="32" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="24" fill="#00e599">N</text></svg>'),
    last_updated: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(),
    raw_text: null,
    scraped_at: '2026-07-10T10:00:00Z',
    analyzed_at: '2026-07-10T10:00:00Z',
    created_at: '2026-07-10T10:00:00Z',
    tool_analyses: {
      id: 'analysis-6',
      tool_id: '6',
      summary: 'The serverless Postgres that scales with your workload.',
      adoption_score: 0.7,
      adoption_label: 'growing',
      tool_rating_label: 'balanced',
      beginner_friendly_percentage: 27,
      balanced_percentage: 48,
      power_user_percentage: 25,
      complexity_score: -0.02,
      confidence: 0.84,
      main_purpose: 'Serverless PostgreSQL database',
      category: 'Database',
      subtitle: 'Serverless Postgres',
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
    brand_text: 'Sentry',
    image_url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#362d59"/><text x="24" y="32" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="24" fill="#e54545">S</text></svg>'),
    last_updated: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(),
    raw_text: null,
    scraped_at: '2026-07-09T10:00:00Z',
    analyzed_at: '2026-07-09T10:00:00Z',
    created_at: '2026-07-09T10:00:00Z',
    tool_analyses: {
      id: 'analysis-7',
      tool_id: '7',
      summary: 'Monitor, detect and fix crashes in real time across your applications.',
      adoption_score: 0.82,
      adoption_label: 'established',
      tool_rating_label: 'power-user',
      beginner_friendly_percentage: 29,
      balanced_percentage: 46,
      power_user_percentage: 25,
      complexity_score: -0.04,
      confidence: 0.87,
      main_purpose: 'Error tracking and monitoring',
      category: 'Monitoring',
      subtitle: 'Error Monitoring',
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
    brand_text: 'convex',
    image_url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#1a1a2e"/><text x="24" y="32" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="24" fill="#00b4d8">C</text></svg>'),
    last_updated: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(),
    raw_text: null,
    scraped_at: '2026-07-08T10:00:00Z',
    analyzed_at: '2026-07-08T10:00:00Z',
    created_at: '2026-07-08T10:00:00Z',
    tool_analyses: {
      id: 'analysis-8',
      tool_id: '8',
      summary: 'The reactive backend for developers. Real-time, collaborative and scalable.',
      adoption_score: 0.55,
      adoption_label: 'growing',
      tool_rating_label: 'balanced',
      beginner_friendly_percentage: 26,
      balanced_percentage: 47,
      power_user_percentage: 27,
      complexity_score: 0.01,
      confidence: 0.8,
      main_purpose: 'Full-stack backend platform',
      category: 'Backend',
      subtitle: 'Backend Platform',
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
    brand_text: 'Prisma',
    image_url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#1a1a2e"/><text x="24" y="32" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="24" fill="#5a67d8">P</text></svg>'),
    last_updated: new Date(Date.now() - 74 * 60 * 60 * 1000).toISOString(),
    raw_text: null,
    scraped_at: '2026-07-07T10:00:00Z',
    analyzed_at: '2026-07-07T10:00:00Z',
    created_at: '2026-07-07T10:00:00Z',
    tool_analyses: {
      id: 'analysis-9',
      tool_id: '9',
      summary: 'Next-generation ORM for TypeScript & Node.js.',
      adoption_score: 0.75,
      adoption_label: 'established',
      tool_rating_label: 'balanced',
      beginner_friendly_percentage: 31,
      balanced_percentage: 44,
      power_user_percentage: 25,
      complexity_score: -0.06,
      confidence: 0.86,
      main_purpose: 'Database ORM for Node.js',
      category: 'ORM',
      subtitle: 'Database ORM',
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
    brand_text: 'PlanetScale',
    image_url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#000"/><text x="24" y="32" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="24" fill="#e2e8f0">P</text></svg>'),
    last_updated: new Date(Date.now() - 98 * 60 * 60 * 1000).toISOString(),
    raw_text: null,
    scraped_at: '2026-07-06T10:00:00Z',
    analyzed_at: '2026-07-06T10:00:00Z',
    created_at: '2026-07-06T10:00:00Z',
    tool_analyses: {
      id: 'analysis-10',
      tool_id: '10',
      summary: 'The serverless MySQL database built for modern apps.',
      adoption_score: 0.68,
      adoption_label: 'growing',
      tool_rating_label: 'power-user',
      beginner_friendly_percentage: 28,
      balanced_percentage: 48,
      power_user_percentage: 24,
      complexity_score: -0.04,
      confidence: 0.83,
      main_purpose: 'Serverless MySQL database',
      category: 'Database',
      subtitle: 'MySQL Platform',
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
    brand_text: 'Railway',
    image_url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#000"/><text x="24" y="32" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="24" fill="#e2e8f0">R</text></svg>'),
    last_updated: new Date(Date.now() - 98 * 60 * 60 * 1000).toISOString(),
    raw_text: null,
    scraped_at: '2026-07-05T10:00:00Z',
    analyzed_at: '2026-07-05T10:00:00Z',
    created_at: '2026-07-05T10:00:00Z',
    tool_analyses: {
      id: 'analysis-11',
      tool_id: '11',
      summary: 'Deploy your app, database, and background jobs with ease.',
      adoption_score: 0.6,
      adoption_label: 'growing',
      tool_rating_label: 'beginner-friendly',
      beginner_friendly_percentage: 25,
      balanced_percentage: 47,
      power_user_percentage: 28,
      complexity_score: 0.03,
      confidence: 0.81,
      main_purpose: 'Zero-config deployment',
      category: 'DevOps',
      subtitle: 'App Deployment',
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
    brand_text: 'CLOUDFLARE',
    image_url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#f48120"/><text x="24" y="30" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="14" fill="#fff">CF</text></svg>'),
    last_updated: new Date(Date.now() - 122 * 60 * 60 * 1000).toISOString(),
    raw_text: null,
    scraped_at: '2026-07-04T10:00:00Z',
    analyzed_at: '2026-07-04T10:00:00Z',
    created_at: '2026-07-04T10:00:00Z',
    tool_analyses: {
      id: 'analysis-12',
      tool_id: '12',
      summary: 'Security, performance, and reliability for your websites and apps.',
      adoption_score: 0.88,
      adoption_label: 'established',
      tool_rating_label: 'power-user',
      beginner_friendly_percentage: 34,
      balanced_percentage: 43,
      power_user_percentage: 23,
      complexity_score: -0.11,
      confidence: 0.89,
      main_purpose: 'Cloud infrastructure platform',
      category: 'Cloud',
      subtitle: 'Web Infrastructure',
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

// Source counts per tool (simulating real multi-source data)
export const toolSourceCounts: Record<string, number> = {
  '1': 18,
  '2': 21,
  '3': 16,
  '4': 17,
  '5': 11,
  '6': 14,
  '7': 20,
  '8': 12,
  '9': 19,
  '10': 13,
  '11': 15,
  '12': 23,
}

// Category filter mapping: filter pills → tool badge categories
const categoryFilterMap: Record<string, string[]> = {
  'All': [],
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

export function getTools(category?: string): ToolWithAnalysis[] {
  let tools = mockTools.filter(tool => tool.analyzed_at && tool.tool_analyses)

  if (category && category !== 'All') {
    const allowedCategories = categoryFilterMap[category] ?? []
    tools = tools.filter(tool =>
      allowedCategories.includes(tool.tool_analyses?.category ?? '')
    )
  }

  return tools.sort((a, b) => {
    const diff = new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
    if (diff !== 0) return diff
    // Tiebreak: most recently created first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export function getCategories(): string[] {
  // Fixed pill order matching the reference UI
  return ['All', 'AI Tools', 'Developer Tools', 'Backend', 'Frontend', 'Database', 'DevOps', 'Productivity', 'Security', 'Cloud']
}

export function getToolById(id: string): ToolWithAnalysis | undefined {
  return mockTools.find(tool => tool.id === id)
}

export function getRelatedTools(toolId: string, category?: string): ToolWithAnalysis[] {
  const byCategory = mockTools
    .filter(tool => tool.id !== toolId && tool.tool_analyses?.category === category)
    .slice(0, 5)
  
  if (byCategory.length >= 3) return byCategory
  
  // Fallback: show any other tools to fill remaining slots
  const remaining = 5 - byCategory.length
  const others = mockTools
    .filter(tool => tool.id !== toolId && !byCategory.some(t => t.id === tool.id))
    .slice(0, remaining)
  
  return [...byCategory, ...others]
}
