-- DevScout AI Sample Tools & Analyses Seed Data
-- ================================================
-- Paste this into Supabase Dashboard → SQL Editor and run.
-- Inserts 7 tool sources (idempotent), 12 sample tools, and their analyses.
-- Safe to re-run — uses ON CONFLICT to skip existing rows.
--
-- Category-to-pill mapping (for reference):
--   AI Coding      → AI Tools
--   Authentication → Security
--   Backend        → Backend
--   Deployment     → Frontend
--   Email          → Developer Tools
--   ORM            → Developer Tools
--   Database       → Database
--   DevOps         → DevOps
--   Monitoring     → Productivity
--   Cloud          → Cloud

-- ============================================================================
-- 1. TOOL SOURCES (idempotent — already seeded, but included for completeness)
-- ============================================================================
insert into public.tool_sources (name, listing_url, logo_url, active, parser_strategy)
values
    ('Product Hunt', 'https://producthunt.com', 'https://bookface-images.s3.amazonaws.com/logos/97f0c3ad2f9e359b740502c375a9588fc5d42306.png', true, 'producthunt'),
    ('Hacker News', 'https://news.ycombinator.com', 'https://news.ycombinator.com/favicon.ico', true, 'hackernews'),
    ('GitHub Trending', 'https://github.com/trending', 'https://github.githubassets.com/favicons/favicon.svg', true, 'github-trending'),
    ('BetaList', 'https://betalist.com', 'https://betalist.com/favicon.ico', true, 'betalist'),
    ('SaaSHub', 'https://saashub.com', 'https://saashub.com/favicon.ico', true, 'saashub'),
    ('Dev.to', 'https://dev.to', 'https://dev.to/favicon.ico', true, 'devto'),
    ('Reddit r/SideProject', 'https://reddit.com/r/SideProject', 'https://reddit.com/favicon.ico', true, 'reddit')
on conflict (listing_url) do nothing;

-- ============================================================================
-- 2. TOOLS
-- ============================================================================
with source_ids as (
    select id, listing_url from public.tool_sources
),
tool_insert as (
    insert into public.tools (
        source_id,
        original_url,
        canonical_url,
        name,
        brand_text,
        image_url,
        website_url,
        curation_status,
        last_updated,
        raw_text,
        analyzed_at
    )
    select
        (select id from source_ids where listing_url = 'https://producthunt.com'),
        'https://cursor.com',
        'https://cursor.com',
        'Cursor',
        'AI Code Editor',
        'https://cdn.simpleicons.org/cursor',                  -- source: cdn.simpleicons.org (returns cursor SVG logo)
        'https://cursor.com',
        'curated',
        now() - interval '2 hours',
        'Cursor is an AI-first code editor built from the ground up with AI at its core. It provides intelligent code completion, generation, and multi-file editing capabilities that help developers write software faster. The editor integrates deeply with VS Code extensions and supports natural language commands for common coding tasks. With features like AI-powered terminal commands, codebase-wide refactoring, and contextual code suggestions, Cursor aims to reduce boilerplate and accelerate development workflows for teams of all sizes.',
        now()
    where not exists (select 1 from public.tools where original_url = 'https://cursor.com')

    union all

    select
        (select id from source_ids where listing_url = 'https://github.com/trending'),
        'https://supabase.com',
        'https://supabase.com',
        'Supabase',
        'Open Source Backend',
        'https://cdn.simpleicons.org/supabase/3ecf8e',        -- source: cdn.simpleicons.org (green-tinted supabase SVG logo)
        'https://supabase.com',
        'curated',
        now() - interval '2 hours',
        'Supabase is an open-source Firebase alternative that provides a complete backend solution built on PostgreSQL. It offers a managed database with auto-scaling, built-in authentication with social providers, real-time subscriptions, edge functions, and file storage. Developers can use the Supabase dashboard to manage their data, write SQL queries, and configure authentication without managing infrastructure. With its generous free tier and seamless integration with modern frameworks, Supabase has become a popular choice for startups and full-stack developers seeking a scalable backend platform.',
        now()
    where not exists (select 1 from public.tools where original_url = 'https://supabase.com')

    union all

    select
        (select id from source_ids where listing_url = 'https://producthunt.com'),
        'https://clerk.com',
        'https://clerk.com',
        'Clerk',
        'Authentication Platform',
        'https://cdn.simpleicons.org/clerk',                  -- source: cdn.simpleicons.org (returns clerk SVG logo; fixed typo: was placehold.co/400x400xa)
        'https://clerk.com',
        'curated',
        now() - interval '2 hours',
        'Clerk is a complete authentication and user management platform that makes adding sign-in, sign-up, and user profiles to any application quick and secure. It provides pre-built UI components for login flows, multi-tenant organization support, session management, and webhook integrations. Clerk supports multiple authentication methods including social logins, magic links, and passkeys, and works seamlessly with React, Next.js, and other modern frameworks. Its developer-first approach and beautiful default UI make it easy to implement enterprise-grade authentication without building from scratch.',
        now()
    where not exists (select 1 from public.tools where original_url = 'https://clerk.com')

    union all

    select
        (select id from source_ids where listing_url = 'https://producthunt.com'),
        'https://vercel.com',
        'https://vercel.com',
        'Vercel',
        'Deployment Platform',
        'https://cdn.simpleicons.org/vercel/000000/ffffff',   -- source: cdn.simpleicons.org (dark/light adaptive SVG logo)
        'https://vercel.com',
        'curated',
        now() - interval '26 hours',
        'Vercel is the platform for frontend frameworks and static sites, built for speed and global scale. It provides instant deployments from Git repositories, serverless functions, edge computing, analytics, and an integrated CDN. Vercel offers automatic HTTPS, preview deployments for every pull request, and a composable architecture that works with Next.js, React, Svelte, and other modern frameworks. Its developer experience focuses on zero-configuration deployments and seamless collaboration features for teams building modern web applications.',
        now()
    where not exists (select 1 from public.tools where original_url = 'https://vercel.com')

    union all

    select
        (select id from source_ids where listing_url = 'https://producthunt.com'),
        'https://resend.com',
        'https://resend.com',
        'Resend',
        'Email API',
        'https://cdn.simpleicons.org/resend',                 -- source: cdn.simpleicons.org (returns resend SVG logo)
        'https://resend.com',
        'curated',
        now() - interval '26 hours',
        'Resend is a developer-friendly email API that makes it easy to send transactional and marketing emails from your application. It provides a simple REST API, React-based email templates, analytics dashboards, and real-time delivery webhooks. Resend focuses on high deliverability rates, fast sending times, and a clean developer experience. With support for multiple SDKs including React, Node.js, and Python, it enables teams to build and iterate on email workflows quickly without managing email infrastructure.',
        now()
    where not exists (select 1 from public.tools where original_url = 'https://resend.com')

    union all

    select
        (select id from source_ids where listing_url = 'https://github.com/trending'),
        'https://prisma.io',
        'https://prisma.io',
        'Prisma',
        'Database ORM',
        'https://cdn.simpleicons.org/prisma',                 -- source: cdn.simpleicons.org (returns prisma SVG logo)
        'https://prisma.io',
        'curated',
        now() - interval '74 hours',
        'Prisma is a next-generation ORM for TypeScript and Node.js that provides type-safe database access and a declarative data modeling approach. It offers an intuitive data model language, automatic migrations, a graphical database browser called Prisma Studio, and a type-safe client that catches errors at compile time. Prisma supports PostgreSQL, MySQL, SQLite, MongoDB, and SQL Server, and integrates with frameworks like Next.js, NestJS, and Express. Its focus on developer experience and type safety has made it one of the most popular database tools in the TypeScript ecosystem.',
        now()
    where not exists (select 1 from public.tools where original_url = 'https://prisma.io')

    union all

    select
        (select id from source_ids where listing_url = 'https://producthunt.com'),
        'https://stripe.com',
        'https://stripe.com',
        'Stripe',
        'Payment Infrastructure',
        'https://cdn.simpleicons.org/stripe',                 -- source: cdn.simpleicons.org (returns stripe SVG logo)
        'https://stripe.com',
        'curated',
        now() - interval '50 hours',
        'Stripe is a comprehensive payment infrastructure platform that enables businesses to accept payments, manage subscriptions, and handle complex financial workflows online. It provides APIs for payment processing, billing, invoicing, Connect for marketplace platforms, and Stripe Atlas for company formation. With support for over 135 currencies, built-in fraud prevention with Radar, and extensive global compliance coverage, Stripe handles the financial complexity so developers can focus on building their product. Its well-documented APIs and libraries for every major language make it the standard choice for online payment processing.',
        now()
    where not exists (select 1 from public.tools where original_url = 'https://stripe.com')

    union all

    select
        (select id from source_ids where listing_url = 'https://producthunt.com'),
        'https://planetscale.com',
        'https://planetscale.com',
        'PlanetScale',
        'MySQL Platform',
        'https://cdn.simpleicons.org/planetscale',            -- source: cdn.simpleicons.org (returns planetscale SVG logo)
        'https://planetscale.com',
        'curated',
        now() - interval '98 hours',
        'PlanetScale is a serverless MySQL database platform built on Vitess that offers database branching, non-blocking schema changes, and connection pooling. It provides a developer workflow similar to Git, where databases can be branched for development and deployed to production with zero-downtime migrations. PlanetScale includes a web console for query management, automated backups, and built-in connection pooling. Its focus on enabling safe schema changes and developer-friendly database operations makes it popular for teams shipping frequently.',
        now()
    where not exists (select 1 from public.tools where original_url = 'https://planetscale.com')

    union all

    select
        (select id from source_ids where listing_url = 'https://producthunt.com'),
        'https://railway.app',
        'https://railway.app',
        'Railway',
        'App Deployment',
        'https://cdn.simpleicons.org/railway',                -- source: cdn.simpleicons.org (returns railway SVG logo)
        'https://railway.app',
        'curated',
        now() - interval '98 hours',
        'Railway is a zero-configuration deployment platform that makes it easy to deploy applications, databases, and background jobs. It provides instant deploys from GitHub repositories, managed PostgreSQL and Redis databases, custom domains with automatic SSL, and environment variable management. Railway supports any language or framework and automatically detects the runtime configuration. Its focus on simplicity and developer experience makes it popular for solo developers and small teams who want to ship applications without managing cloud infrastructure.',
        now()
    where not exists (select 1 from public.tools where original_url = 'https://railway.app')

    union all

    select
        (select id from source_ids where listing_url = 'https://github.com/trending'),
        'https://coolify.io',
        'https://coolify.io',
        'Coolify',
        'Self-hosted PaaS',
        'https://cdn.simpleicons.org/coolify',                -- source: cdn.simpleicons.org (returns coolify SVG logo)
        'https://coolify.io',
        'curated',
        now() - interval '122 hours',
        'Coolify is an open-source, self-hosted Platform-as-a-Service that provides an alternative to Vercel, Netlify, and Heroku. It allows developers to deploy applications, databases, and services on their own infrastructure with a beautiful web interface. Coolify supports one-click deployments from GitHub, GitLab, and Bitbucket, automatic SSL certificates via Let''s Encrypt, and supports any programming language or framework. It includes managed databases, background job processing, and real-time deployment logs, giving developers full control over their infrastructure without sacrificing convenience.',
        now()
    where not exists (select 1 from public.tools where original_url = 'https://coolify.io')

    union all

    select
        (select id from source_ids where listing_url = 'https://producthunt.com'),
        'https://trigger.dev',
        'https://trigger.dev',
        'Trigger.dev',
        'Background Jobs',
        'https://trigger.dev/assets/triggerdev-logo--light.svg',  -- source: trigger.dev official brand kit (green gradient SVG logo; not on simpleicons)
        'https://trigger.dev',
        'curated',
        now() - interval '146 hours',
        'Trigger.dev is an open-source platform for creating and managing long-running background jobs and workflows in your application. It provides a TypeScript-native SDK for defining jobs with delays, schedules, and webhook triggers. Jobs can run for hours and include complex logic like API calls, database operations, and external service integrations. Trigger.dev offers real-time monitoring, automatic retries with exponential backoff, and a dashboard for inspecting job runs. Its focus on developer experience and reliability makes it ideal for teams that need to orchestrate complex background processes.',
        now()
    where not exists (select 1 from public.tools where original_url = 'https://trigger.dev')

    union all

    select
        (select id from source_ids where listing_url = 'https://producthunt.com'),
        'https://inngest.com',
        'https://inngest.com',
        'Inngest',
        'Workflow Platform',
        'https://www.inngest.com/logo-with-icon-white.svg',      -- source: inngest.com official brand logo (from JSON-LD; white logo SVG; not on simpleicons)
        'https://inngest.com',
        'curated',
        now() - interval '146 hours',
        'Inngest is a developer platform for building and managing reliable workflow and background job pipelines. It provides a serverless execution environment where developers can define steps as functions that are automatically retried on failure and can run for extended durations. Inngest supports scheduled jobs, event-driven workflows, fan-out patterns, and idempotency guarantees out of the box. With its easy-to-use SDK, detailed logging, and observability dashboard, Inngest helps teams build resilient workflows without managing queues, workers, or infrastructure.',
        now()
    where not exists (select 1 from public.tools where original_url = 'https://inngest.com')

    returning id, name
)
-- ============================================================================
-- 3. TOOL ANALYSES
-- ============================================================================
insert into public.tool_analyses (
    tool_id,
    summary,
    adoption_score,
    adoption_label,
    tool_rating_label,
    beginner_friendly_percentage,
    balanced_percentage,
    power_user_percentage,
    complexity_score,
    confidence,
    main_purpose,
    category,
    target_users,
    key_features,
    pros,
    cons,
    pricing_model,
    integrations,
    best_for,
    marketing_buzzwords,
    rating_notes,
    disclaimer,
    model
)
select
    t.id,
    'The AI-first code editor that helps you build faster with intelligent autocomplete, code generation, and multi-file editing capabilities.',
    0.85,
    'established',
    'balanced',
    25, 50, 25,
    (25 - 25) / 100.0,
    0.90,
    'AI-assisted code editing',
    'AI Coding',
    'Developers, engineers, and technical teams',
    array['AI code completion', 'Code generation', 'Multi-file editing', 'Terminal integration'],
    array['Significant productivity boost', 'Excellent AI integration', 'Familiar VS Code interface'],
    array['Subscription required for advanced features', 'Can be resource-intensive'],
    'freemium',
    array['VS Code extensions', 'Git', 'GitHub Copilot'],
    'Developers seeking AI-enhanced coding experience',
    array['AI-powered', 'Intelligent', 'Productivity'],
    'Strong AI capabilities with familiar VS Code interface. Particularly effective for repetitive coding tasks and boilerplate generation.',
    'AI features require active subscription. Results vary based on codebase complexity.',
    'gpt-4o'
from public.tools t
left join public.tool_analyses ta on ta.tool_id = t.id
where t.name = 'Cursor'
  and ta.tool_id is null

union all

select
    t.id,
    'Build and scale your app with a managed PostgreSQL database, authentication, real-time subscriptions, edge functions, and file storage.',
    0.78,
    'established',
    'balanced',
    28, 47, 25,
    (25 - 28) / 100.0,
    0.88,
    'Backend-as-a-Service platform',
    'Backend',
    'Full-stack developers, startups, and growing teams',
    array['PostgreSQL database', 'Built-in authentication', 'Edge functions', 'Real-time subscriptions', 'File storage'],
    array['Open source with no vendor lock-in', 'Excellent documentation and guides', 'Generous free tier', 'Active community'],
    array['Can be complex for simple projects', 'Limited enterprise features', 'Some services still maturing'],
    'freemium',
    array['React', 'Next.js', 'Flutter', 'Vue', 'Svelte'],
    'Startups and developers needing a scalable backend without managing infrastructure',
    array['Open source', 'Firebase alternative', 'Real-time', 'PostgreSQL'],
    'Strong community and ecosystem. Excellent choice for projects that need a full backend stack quickly.',
    'Enterprise features require paid plan. Self-hosting option available for advanced users.',
    'gpt-4o'
from public.tools t
left join public.tool_analyses ta on ta.tool_id = t.id
where t.name = 'Supabase'
  and ta.tool_id is null

union all

select
    t.id,
    'Add sign-in, sign-up, user profiles, and organization management to your application in minutes with pre-built UI components.',
    0.72,
    'growing',
    'beginner-friendly',
    30, 45, 25,
    (25 - 30) / 100.0,
    0.85,
    'Authentication and user management platform',
    'Authentication',
    'Web and mobile developers of all skill levels',
    array['Pre-built sign-in/sign-up flows', 'Multi-tenant organizations', 'Session management', 'Social login providers'],
    array['Easy integration with modern frameworks', 'Beautiful pre-built UI components', 'Excellent documentation', 'Generous free tier'],
    array['Vendor lock-in for auth state', 'Pricing can be complex at scale'],
    'freemium',
    array['React', 'Next.js', 'Remix', 'Vue', 'Firebase'],
    'Developers needing quick, secure authentication setup',
    array['Complete', 'Beautiful', 'Secure', 'Developer-first'],
    'Excellent developer experience with minimal setup required. Pre-built components significantly reduce implementation time.',
    'Pricing scales with monthly active users. Enterprise features available on higher tiers.',
    'gpt-4o'
from public.tools t
left join public.tool_analyses ta on ta.tool_id = t.id
where t.name = 'Clerk'
  and ta.tool_id is null

union all

select
    t.id,
    'The platform for frontend frameworks and static sites, providing instant global deployments and serverless computing.',
    0.90,
    'established',
    'balanced',
    32, 45, 23,
    (23 - 32) / 100.0,
    0.92,
    'Frontend deployment and hosting platform',
    'Deployment',
    'Frontend and full-stack developers, design teams',
    array['Instant Git-based deployments', 'Serverless edge functions', 'Global CDN', 'Preview deployments', 'Analytics'],
    array['Excellent developer experience', 'Fast deployments with automatic HTTPS', 'Great Next.js integration', 'Preview for every PR'],
    array['Can be expensive at high scale', 'Vendor lock-in concerns', 'Limited backend capabilities'],
    'usage-based',
    array['Next.js', 'React', 'Vue', 'Svelte', 'Astro'],
    'Teams deploying modern web applications with Jamstack architecture',
    array['Fast', 'Reliable', 'Global', 'Serverless'],
    'Industry standard for Next.js and modern frontend deployments. Edge network provides excellent global performance.',
    'Pricing based on bandwidth and serverless function usage. Enterprise plans available.',
    'gpt-4o'
from public.tools t
left join public.tool_analyses ta on ta.tool_id = t.id
where t.name = 'Vercel'
  and ta.tool_id is null

union all

select
    t.id,
    'A developer-friendly email API that provides reliable email delivery with simple SDKs and comprehensive analytics.',
    0.65,
    'growing',
    'beginner-friendly',
    26, 49, 25,
    (25 - 26) / 100.0,
    0.82,
    'Transactional email delivery service',
    'Email',
    'Developers and product teams sending transactional emails',
    array['Simple REST API', 'React email templates', 'Delivery analytics', 'Real-time webhooks'],
    array['Simple and clean API', 'Great developer documentation', 'Fast email delivery', 'Excellent deliverability'],
    array['Limited free tier', 'No drag-and-drop editor', 'Relatively new platform'],
    'usage-based',
    array['React', 'Next.js', 'Node.js', 'Python', 'Ruby'],
    'Developers needing reliable transactional email infrastructure',
    array['Simple', 'Fast', 'Developer-first', 'Reliable'],
    'Excellent choice for transactional email. The React-based template approach is innovative.',
    'Pricing based on email volume. Advanced features on higher tiers.',
    'gpt-4o'
from public.tools t
left join public.tool_analyses ta on ta.tool_id = t.id
where t.name = 'Resend'
  and ta.tool_id is null

union all

select
    t.id,
    'A next-generation ORM for TypeScript and Node.js that provides type-safe database access and declarative data modeling.',
    0.75,
    'established',
    'balanced',
    31, 44, 25,
    (25 - 31) / 100.0,
    0.86,
    'Type-safe database access and schema management',
    'ORM',
    'Backend and full-stack TypeScript developers',
    array['Type-safe database client', 'Declarative schema modeling', 'Automatic migrations', 'Prisma Studio GUI'],
    array['Excellent type safety with full autocompletion', 'Great documentation and guides', 'Active community and ecosystem'],
    array['Learning curve for complex queries', 'Migration generation can be complex', 'Performance overhead for simple queries'],
    'free',
    array['PostgreSQL', 'MySQL', 'SQLite', 'MongoDB', 'SQL Server'],
    'TypeScript developers wanting type-safe database access',
    array['Type-safe', 'Next-gen', 'Developer experience'],
    'Excellent choice for TypeScript projects. The type-safe client eliminates an entire class of runtime errors.',
    'Open source with commercial support available. Prisma Cloud and Data Platform are separate products.',
    'gpt-4o'
from public.tools t
left join public.tool_analyses ta on ta.tool_id = t.id
where t.name = 'Prisma'
  and ta.tool_id is null

union all

select
    t.id,
    'A comprehensive payment infrastructure platform for accepting payments, managing subscriptions, and handling complex financial workflows online.',
    0.88,
    'established',
    'balanced',
    27, 46, 27,
    (27 - 27) / 100.0,
    0.91,
    'Online payment processing and financial infrastructure',
    'Backend',
    'Businesses of all sizes, SaaS companies, e-commerce',
    array['Payment processing', 'Subscription management', 'Invoicing and billing', 'Stripe Connect marketplace', 'Fraud prevention'],
    array['Well-documented APIs and SDKs', 'Global payment coverage', 'Strong security and compliance', 'Innovative product suite'],
    array['Complex pricing structure', 'High transaction fees for small businesses', 'Can be overwhelming for simple needs'],
    'usage-based',
    array['React', 'Node.js', 'Python', 'Ruby', 'Java', 'iOS', 'Android'],
    'Online businesses needing reliable payment processing and financial tools',
    array['Global', 'Secure', 'Scalable', 'Developer-friendly'],
    'Industry standard for online payments. Comprehensive APIs handle nearly every payment workflow.',
    'Transaction fees apply per payment. Additional costs for premium features like Radar fraud protection.',
    'gpt-4o'
from public.tools t
left join public.tool_analyses ta on ta.tool_id = t.id
where t.name = 'Stripe'
  and ta.tool_id is null

union all

select
    t.id,
    'A serverless MySQL database platform with database branching, non-blocking schema changes, and developer-friendly workflows.',
    0.68,
    'growing',
    'balanced',
    28, 48, 24,
    (24 - 28) / 100.0,
    0.83,
    'Serverless MySQL database platform',
    'Database',
    'Backend developers, DBAs, and platform teams',
    array['MySQL-compatible database', 'Database branching with deploy requests', 'Non-blocking schema changes', 'Connection pooling', 'Query console'],
    array['Innovative branching workflow', 'Great performance at scale', 'Zero-downtime schema migrations'],
    array['MySQL only, no PostgreSQL support', 'Pricing can be complex', 'Limited regions compared to some competitors'],
    'usage-based',
    array['Prisma', 'TypeORM', 'Sequelize', 'Next.js', 'Rails'],
    'Teams needing scalable MySQL databases with safe migration workflows',
    array['Serverless', 'Branching', 'Non-blocking', 'MySQL'],
    'Excellent for teams that need safe schema change workflows. Database branching is a standout feature.',
    'Pricing based on storage, row reads, and writes. Free tier available for development.',
    'gpt-4o'
from public.tools t
left join public.tool_analyses ta on ta.tool_id = t.id
where t.name = 'PlanetScale'
  and ta.tool_id is null

union all

select
    t.id,
    'A zero-configuration deployment platform that makes it easy to deploy apps, databases, and background jobs from GitHub.',
    0.60,
    'growing',
    'beginner-friendly',
    25, 47, 28,
    (28 - 25) / 100.0,
    0.81,
    'Zero-config application deployment',
    'DevOps',
    'Solo developers, indie hackers, and small teams',
    array['Zero-config Git-based deployments', 'Managed PostgreSQL and Redis', 'Custom domains with SSL', 'Environment variable management'],
    array['Extremely easy to use', 'Fast deployment times', 'Generous free tier', 'Automatic infrastructure management'],
    array['Limited customization options', 'Smaller ecosystem than competitors', 'Can get expensive at scale'],
    'usage-based',
    array['GitHub', 'Docker', 'PostgreSQL', 'Redis', 'Node.js', 'Python'],
    'Developers wanting simple, fast deployment without managing infrastructure',
    array['Zero config', 'Instant', 'Simple', 'Developer experience'],
    'Great for rapid prototyping and small projects. The simplicity of deploying from GitHub is outstanding.',
    'Pricing based on resource usage (CPU, memory, storage). Free tier includes limited resources.',
    'gpt-4o'
from public.tools t
left join public.tool_analyses ta on ta.tool_id = t.id
where t.name = 'Railway'
  and ta.tool_id is null

union all

select
    t.id,
    'An open-source, self-hosted Platform-as-a-Service alternative to Vercel, Netlify, and Heroku that runs on your own infrastructure.',
    0.45,
    'early-stage',
    'power-user',
    29, 46, 25,
    (25 - 29) / 100.0,
    0.75,
    'Self-hosted application deployment platform',
    'DevOps',
    'Developers and teams wanting self-hosted infrastructure',
    array['One-click deployments from Git providers', 'Automatic SSL certificates', 'Managed databases', 'Real-time deployment logs'],
    array['Full control over infrastructure', 'Open source with active community', 'Cost-effective for self-hosters', 'Beautiful admin interface'],
    array['Requires own server infrastructure', 'Setup can be complex', 'Smaller community than commercial alternatives'],
    'free',
    array['GitHub', 'GitLab', 'Bitbucket', 'Docker', 'PostgreSQL', 'Redis'],
    'Teams wanting to self-host applications with a PaaS-like experience',
    array['Open source', 'Self-hosted', 'PaaS', 'Cost-effective'],
    'Great alternative for teams that want PaaS convenience with full infrastructure control. Open source license ensures no vendor lock-in.',
    'Open source and free to self-host. Requires your own server with Docker installed.',
    'gpt-4o'
from public.tools t
left join public.tool_analyses ta on ta.tool_id = t.id
where t.name = 'Coolify'
  and ta.tool_id is null

union all

select
    t.id,
    'An open-source platform for creating and managing long-running background jobs and workflows with TypeScript-native SDK.',
    0.40,
    'early-stage',
    'balanced',
    24, 48, 28,
    (28 - 24) / 100.0,
    0.72,
    'Background job and workflow orchestration',
    'Monitoring',
    'Backend developers building complex background workflows',
    array['TypeScript-native job SDK', 'Scheduled and delayed jobs', 'Automatic retry with backoff', 'Real-time job monitoring'],
    array['Great TypeScript developer experience', 'Open source with MIT license', 'Handles complex workflow patterns'],
    array['Relatively new and evolving', 'Limited integrations initially', 'Smaller community'],
    'free',
    array['Next.js', 'Node.js', 'React', 'TypeScript', 'Supabase'],
    'TypeScript developers needing reliable background job processing',
    array['Open source', 'TypeScript', 'Background jobs', 'Workflows'],
    'Promising open-source alternative for background job processing with strong TypeScript support.',
    'Open source project. Cloud hosted version available separately with additional features.',
    'gpt-4o'
from public.tools t
left join public.tool_analyses ta on ta.tool_id = t.id
where t.name = 'Trigger.dev'
  and ta.tool_id is null

union all

select
    t.id,
    'A developer platform for building reliable background workflows and job pipelines with serverless step functions.',
    0.38,
    'early-stage',
    'balanced',
    26, 47, 27,
    (27 - 26) / 100.0,
    0.70,
    'Event-driven workflow and background job platform',
    'Monitoring',
    'Developers building event-driven workflows and data pipelines',
    array['Serverless step functions', 'Event-driven triggers', 'Scheduled and cron jobs', 'Automatic retry and idempotency'],
    array['Powerful workflow orchestration', 'Good observability dashboard', 'Handles complex failure scenarios well'],
    array['Learning curve for workflow modeling', 'Limited language support initially', 'Relatively new platform'],
    'freemium',
    array['Next.js', 'Node.js', 'TypeScript', 'Supabase', 'Vercel'],
    'Teams needing reliable event-driven workflow and background job infrastructure',
    array['Serverless', 'Workflows', 'Event-driven', 'Reliable'],
    'Powerful workflow orchestration capabilities with strong reliability guarantees and good observability.',
    'Free tier available. Pricing based on number of steps executed and duration.',
    'gpt-4o'
from public.tools t
left join public.tool_analyses ta on ta.tool_id = t.id
where t.name = 'Inngest'
  and ta.tool_id is null

on conflict (tool_id) do nothing;

-- ============================================================================
-- 4. VERIFICATION QUERIES (uncomment to run)
-- ============================================================================
-- select 'tool_sources' as tbl, count(*) from public.tool_sources
-- union all
-- select 'tools' as tbl, count(*) from public.tools
-- union all
-- select 'tool_analyses' as tbl, count(*) from public.tool_analyses;
--
-- select t.name, ta.category, ta.tool_rating_label, ta.complexity_score
-- from public.tools t
-- join public.tool_analyses ta on ta.tool_id = t.id
-- order by t.name;
