#!/usr/bin/env node
// Seed tool_analyses via Supabase REST API
// Run: node scripts/seed-analyses.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

// All analysis data keyed by tool name (matching the seed-data.sql values exactly)
const analyses = [
  {
    name: 'Cursor',
    summary: 'The AI-first code editor that helps you build faster with intelligent autocomplete, code generation, and multi-file editing capabilities.',
    adoption_score: 0.85, adoption_label: 'established', tool_rating_label: 'balanced',
    beginner_friendly_percentage: 25, balanced_percentage: 50, power_user_percentage: 25,
    complexity_score: (25 - 25) / 100.0, confidence: 0.90,
    main_purpose: 'AI-assisted code editing', category: 'AI Coding',
    target_users: 'Developers, engineers, and technical teams',
    key_features: ['AI code completion', 'Code generation', 'Multi-file editing', 'Terminal integration'],
    pros: ['Significant productivity boost', 'Excellent AI integration', 'Familiar VS Code interface'],
    cons: ['Subscription required for advanced features', 'Can be resource-intensive'],
    pricing_model: 'freemium',
    integrations: ['VS Code extensions', 'Git', 'GitHub Copilot'],
    best_for: 'Developers seeking AI-enhanced coding experience',
    marketing_buzzwords: ['AI-powered', 'Intelligent', 'Productivity'],
    rating_notes: 'Strong AI capabilities with familiar VS Code interface. Particularly effective for repetitive coding tasks and boilerplate generation.',
    disclaimer: 'AI features require active subscription. Results vary based on codebase complexity.',
    model: 'gpt-4o'
  },
  {
    name: 'Supabase',
    summary: 'Build and scale your app with a managed PostgreSQL database, authentication, real-time subscriptions, edge functions, and file storage.',
    adoption_score: 0.78, adoption_label: 'established', tool_rating_label: 'balanced',
    beginner_friendly_percentage: 28, balanced_percentage: 47, power_user_percentage: 25,
    complexity_score: (25 - 28) / 100.0, confidence: 0.88,
    main_purpose: 'Backend-as-a-Service platform', category: 'Backend',
    target_users: 'Full-stack developers, startups, and growing teams',
    key_features: ['PostgreSQL database', 'Built-in authentication', 'Edge functions', 'Real-time subscriptions', 'File storage'],
    pros: ['Open source with no vendor lock-in', 'Excellent documentation and guides', 'Generous free tier', 'Active community'],
    cons: ['Can be complex for simple projects', 'Limited enterprise features', 'Some services still maturing'],
    pricing_model: 'freemium',
    integrations: ['React', 'Next.js', 'Flutter', 'Vue', 'Svelte'],
    best_for: 'Startups and developers needing a scalable backend without managing infrastructure',
    marketing_buzzwords: ['Open source', 'Firebase alternative', 'Real-time', 'PostgreSQL'],
    rating_notes: 'Strong community and ecosystem. Excellent choice for projects that need a full backend stack quickly.',
    disclaimer: 'Enterprise features require paid plan. Self-hosting option available for advanced users.',
    model: 'gpt-4o'
  },
  {
    name: 'Clerk',
    summary: 'Add sign-in, sign-up, user profiles, and organization management to your application in minutes with pre-built UI components.',
    adoption_score: 0.72, adoption_label: 'growing', tool_rating_label: 'beginner-friendly',
    beginner_friendly_percentage: 30, balanced_percentage: 45, power_user_percentage: 25,
    complexity_score: (25 - 30) / 100.0, confidence: 0.85,
    main_purpose: 'Authentication and user management platform', category: 'Authentication',
    target_users: 'Web and mobile developers of all skill levels',
    key_features: ['Pre-built sign-in/sign-up flows', 'Multi-tenant organizations', 'Session management', 'Social login providers'],
    pros: ['Easy integration with modern frameworks', 'Beautiful pre-built UI components', 'Excellent documentation', 'Generous free tier'],
    cons: ['Vendor lock-in for auth state', 'Pricing can be complex at scale'],
    pricing_model: 'freemium',
    integrations: ['React', 'Next.js', 'Remix', 'Vue', 'Firebase'],
    best_for: 'Developers needing quick, secure authentication setup',
    marketing_buzzwords: ['Complete', 'Beautiful', 'Secure', 'Developer-first'],
    rating_notes: 'Excellent developer experience with minimal setup required. Pre-built components significantly reduce implementation time.',
    disclaimer: 'Pricing scales with monthly active users. Enterprise features available on higher tiers.',
    model: 'gpt-4o'
  },
  {
    name: 'Vercel',
    summary: 'The platform for frontend frameworks and static sites, providing instant global deployments and serverless computing.',
    adoption_score: 0.90, adoption_label: 'established', tool_rating_label: 'balanced',
    beginner_friendly_percentage: 32, balanced_percentage: 45, power_user_percentage: 23,
    complexity_score: (23 - 32) / 100.0, confidence: 0.92,
    main_purpose: 'Frontend deployment and hosting platform', category: 'Deployment',
    target_users: 'Frontend and full-stack developers, design teams',
    key_features: ['Instant Git-based deployments', 'Serverless edge functions', 'Global CDN', 'Preview deployments', 'Analytics'],
    pros: ['Excellent developer experience', 'Fast deployments with automatic HTTPS', 'Great Next.js integration', 'Preview for every PR'],
    cons: ['Can be expensive at high scale', 'Vendor lock-in concerns', 'Limited backend capabilities'],
    pricing_model: 'usage-based',
    integrations: ['Next.js', 'React', 'Vue', 'Svelte', 'Astro'],
    best_for: 'Teams deploying modern web applications with Jamstack architecture',
    marketing_buzzwords: ['Fast', 'Reliable', 'Global', 'Serverless'],
    rating_notes: 'Industry standard for Next.js and modern frontend deployments. Edge network provides excellent global performance.',
    disclaimer: 'Pricing based on bandwidth and serverless function usage. Enterprise plans available.',
    model: 'gpt-4o'
  },
  {
    name: 'Resend',
    summary: 'A developer-friendly email API that provides reliable email delivery with simple SDKs and comprehensive analytics.',
    adoption_score: 0.65, adoption_label: 'growing', tool_rating_label: 'beginner-friendly',
    beginner_friendly_percentage: 26, balanced_percentage: 49, power_user_percentage: 25,
    complexity_score: (25 - 26) / 100.0, confidence: 0.82,
    main_purpose: 'Transactional email delivery service', category: 'Email',
    target_users: 'Developers and product teams sending transactional emails',
    key_features: ['Simple REST API', 'React email templates', 'Delivery analytics', 'Real-time webhooks'],
    pros: ['Simple and clean API', 'Great developer documentation', 'Fast email delivery', 'Excellent deliverability'],
    cons: ['Limited free tier', 'No drag-and-drop editor', 'Relatively new platform'],
    pricing_model: 'usage-based',
    integrations: ['React', 'Next.js', 'Node.js', 'Python', 'Ruby'],
    best_for: 'Developers needing reliable transactional email infrastructure',
    marketing_buzzwords: ['Simple', 'Fast', 'Developer-first', 'Reliable'],
    rating_notes: 'Excellent choice for transactional email. The React-based template approach is innovative.',
    disclaimer: 'Pricing based on email volume. Advanced features on higher tiers.',
    model: 'gpt-4o'
  },
  {
    name: 'Prisma',
    summary: 'A next-generation ORM for TypeScript and Node.js that provides type-safe database access and declarative data modeling.',
    adoption_score: 0.75, adoption_label: 'established', tool_rating_label: 'balanced',
    beginner_friendly_percentage: 31, balanced_percentage: 44, power_user_percentage: 25,
    complexity_score: (25 - 31) / 100.0, confidence: 0.86,
    main_purpose: 'Type-safe database access and schema management', category: 'ORM',
    target_users: 'Backend and full-stack TypeScript developers',
    key_features: ['Type-safe database client', 'Declarative schema modeling', 'Automatic migrations', 'Prisma Studio GUI'],
    pros: ['Excellent type safety with full autocompletion', 'Great documentation and guides', 'Active community and ecosystem'],
    cons: ['Learning curve for complex queries', 'Migration generation can be complex', 'Performance overhead for simple queries'],
    pricing_model: 'free',
    integrations: ['PostgreSQL', 'MySQL', 'SQLite', 'MongoDB', 'SQL Server'],
    best_for: 'TypeScript developers wanting type-safe database access',
    marketing_buzzwords: ['Type-safe', 'Next-gen', 'Developer experience'],
    rating_notes: 'Excellent choice for TypeScript projects. The type-safe client eliminates an entire class of runtime errors.',
    disclaimer: 'Open source with commercial support available. Prisma Cloud and Data Platform are separate products.',
    model: 'gpt-4o'
  },
  {
    name: 'Stripe',
    summary: 'A comprehensive payment infrastructure platform for accepting payments, managing subscriptions, and handling complex financial workflows online.',
    adoption_score: 0.88, adoption_label: 'established', tool_rating_label: 'balanced',
    beginner_friendly_percentage: 27, balanced_percentage: 46, power_user_percentage: 27,
    complexity_score: (27 - 27) / 100.0, confidence: 0.91,
    main_purpose: 'Online payment processing and financial infrastructure', category: 'Backend',
    target_users: 'Businesses of all sizes, SaaS companies, e-commerce',
    key_features: ['Payment processing', 'Subscription management', 'Invoicing and billing', 'Stripe Connect marketplace', 'Fraud prevention'],
    pros: ['Well-documented APIs and SDKs', 'Global payment coverage', 'Strong security and compliance', 'Innovative product suite'],
    cons: ['Complex pricing structure', 'High transaction fees for small businesses', 'Can be overwhelming for simple needs'],
    pricing_model: 'usage-based',
    integrations: ['React', 'Node.js', 'Python', 'Ruby', 'Java', 'iOS', 'Android'],
    best_for: 'Online businesses needing reliable payment processing and financial tools',
    marketing_buzzwords: ['Global', 'Secure', 'Scalable', 'Developer-friendly'],
    rating_notes: 'Industry standard for online payments. Comprehensive APIs handle nearly every payment workflow.',
    disclaimer: 'Transaction fees apply per payment. Additional costs for premium features like Radar fraud protection.',
    model: 'gpt-4o'
  },
  {
    name: 'PlanetScale',
    summary: 'A serverless MySQL database platform with database branching, non-blocking schema changes, and developer-friendly workflows.',
    adoption_score: 0.68, adoption_label: 'growing', tool_rating_label: 'balanced',
    beginner_friendly_percentage: 28, balanced_percentage: 48, power_user_percentage: 24,
    complexity_score: (24 - 28) / 100.0, confidence: 0.83,
    main_purpose: 'Serverless MySQL database platform', category: 'Database',
    target_users: 'Backend developers, DBAs, and platform teams',
    key_features: ['MySQL-compatible database', 'Database branching with deploy requests', 'Non-blocking schema changes', 'Connection pooling', 'Query console'],
    pros: ['Innovative branching workflow', 'Great performance at scale', 'Zero-downtime schema migrations'],
    cons: ['MySQL only, no PostgreSQL support', 'Pricing can be complex', 'Limited regions compared to some competitors'],
    pricing_model: 'usage-based',
    integrations: ['Prisma', 'TypeORM', 'Sequelize', 'Next.js', 'Rails'],
    best_for: 'Teams needing scalable MySQL databases with safe migration workflows',
    marketing_buzzwords: ['Serverless', 'Branching', 'Non-blocking', 'MySQL'],
    rating_notes: 'Excellent for teams that need safe schema change workflows. Database branching is a standout feature.',
    disclaimer: 'Pricing based on storage, row reads, and writes. Free tier available for development.',
    model: 'gpt-4o'
  },
  {
    name: 'Railway',
    summary: 'A zero-configuration deployment platform that makes it easy to deploy apps, databases, and background jobs from GitHub.',
    adoption_score: 0.60, adoption_label: 'growing', tool_rating_label: 'beginner-friendly',
    beginner_friendly_percentage: 25, balanced_percentage: 47, power_user_percentage: 28,
    complexity_score: (28 - 25) / 100.0, confidence: 0.81,
    main_purpose: 'Zero-config application deployment', category: 'DevOps',
    target_users: 'Solo developers, indie hackers, and small teams',
    key_features: ['Zero-config Git-based deployments', 'Managed PostgreSQL and Redis', 'Custom domains with SSL', 'Environment variable management'],
    pros: ['Extremely easy to use', 'Fast deployment times', 'Generous free tier', 'Automatic infrastructure management'],
    cons: ['Limited customization options', 'Smaller ecosystem than competitors', 'Can get expensive at scale'],
    pricing_model: 'usage-based',
    integrations: ['GitHub', 'Docker', 'PostgreSQL', 'Redis', 'Node.js', 'Python'],
    best_for: 'Developers wanting simple, fast deployment without managing infrastructure',
    marketing_buzzwords: ['Zero config', 'Instant', 'Simple', 'Developer experience'],
    rating_notes: 'Great for rapid prototyping and small projects. The simplicity of deploying from GitHub is outstanding.',
    disclaimer: 'Pricing based on resource usage (CPU, memory, storage). Free tier includes limited resources.',
    model: 'gpt-4o'
  },
  {
    name: 'Coolify',
    summary: 'An open-source, self-hosted Platform-as-a-Service alternative to Vercel, Netlify, and Heroku that runs on your own infrastructure.',
    adoption_score: 0.45, adoption_label: 'early-stage', tool_rating_label: 'power-user',
    beginner_friendly_percentage: 29, balanced_percentage: 46, power_user_percentage: 25,
    complexity_score: (25 - 29) / 100.0, confidence: 0.75,
    main_purpose: 'Self-hosted application deployment platform', category: 'DevOps',
    target_users: 'Developers and teams wanting self-hosted infrastructure',
    key_features: ['One-click deployments from Git providers', 'Automatic SSL certificates', 'Managed databases', 'Real-time deployment logs'],
    pros: ['Full control over infrastructure', 'Open source with active community', 'Cost-effective for self-hosters', 'Beautiful admin interface'],
    cons: ['Requires own server infrastructure', 'Setup can be complex', 'Smaller community than commercial alternatives'],
    pricing_model: 'free',
    integrations: ['GitHub', 'GitLab', 'Bitbucket', 'Docker', 'PostgreSQL', 'Redis'],
    best_for: 'Teams wanting to self-host applications with a PaaS-like experience',
    marketing_buzzwords: ['Open source', 'Self-hosted', 'PaaS', 'Cost-effective'],
    rating_notes: 'Great alternative for teams that want PaaS convenience with full infrastructure control. Open source license ensures no vendor lock-in.',
    disclaimer: 'Open source and free to self-host. Requires your own server with Docker installed.',
    model: 'gpt-4o'
  },
  {
    name: 'Trigger.dev',
    summary: 'An open-source platform for creating and managing long-running background jobs and workflows with TypeScript-native SDK.',
    adoption_score: 0.40, adoption_label: 'early-stage', tool_rating_label: 'balanced',
    beginner_friendly_percentage: 24, balanced_percentage: 48, power_user_percentage: 28,
    complexity_score: (28 - 24) / 100.0, confidence: 0.72,
    main_purpose: 'Background job and workflow orchestration', category: 'Monitoring',
    target_users: 'Backend developers building complex background workflows',
    key_features: ['TypeScript-native job SDK', 'Scheduled and delayed jobs', 'Automatic retry with backoff', 'Real-time job monitoring'],
    pros: ['Great TypeScript developer experience', 'Open source with MIT license', 'Handles complex workflow patterns'],
    cons: ['Relatively new and evolving', 'Limited integrations initially', 'Smaller community'],
    pricing_model: 'free',
    integrations: ['Next.js', 'Node.js', 'React', 'TypeScript', 'Supabase'],
    best_for: 'TypeScript developers needing reliable background job processing',
    marketing_buzzwords: ['Open source', 'TypeScript', 'Background jobs', 'Workflows'],
    rating_notes: 'Promising open-source alternative for background job processing with strong TypeScript support.',
    disclaimer: 'Open source project. Cloud hosted version available separately with additional features.',
    model: 'gpt-4o'
  },
  {
    name: 'Inngest',
    summary: 'A developer platform for building reliable background workflows and job pipelines with serverless step functions.',
    adoption_score: 0.38, adoption_label: 'early-stage', tool_rating_label: 'balanced',
    beginner_friendly_percentage: 26, balanced_percentage: 47, power_user_percentage: 27,
    complexity_score: (27 - 26) / 100.0, confidence: 0.70,
    main_purpose: 'Event-driven workflow and background job platform', category: 'Monitoring',
    target_users: 'Developers building event-driven workflows and data pipelines',
    key_features: ['Serverless step functions', 'Event-driven triggers', 'Scheduled and cron jobs', 'Automatic retry and idempotency'],
    pros: ['Powerful workflow orchestration', 'Good observability dashboard', 'Handles complex failure scenarios well'],
    cons: ['Learning curve for workflow modeling', 'Limited language support initially', 'Relatively new platform'],
    pricing_model: 'freemium',
    integrations: ['Next.js', 'Node.js', 'TypeScript', 'Supabase', 'Vercel'],
    best_for: 'Teams needing reliable event-driven workflow and background job infrastructure',
    marketing_buzzwords: ['Serverless', 'Workflows', 'Event-driven', 'Reliable'],
    rating_notes: 'Powerful workflow orchestration capabilities with strong reliability guarantees and good observability.',
    disclaimer: 'Free tier available. Pricing based on number of steps executed and duration.',
    model: 'gpt-4o'
  }
];

async function main() {
  // 1. Fetch all tools keyed by name
  const { data: tools, error: toolsError } = await supabase.from('tools').select('id, name');
  if (toolsError) { console.error('Error fetching tools:', toolsError); process.exit(1); }

  const toolMap = {};
  for (const t of tools) toolMap[t.name] = t.id;

  console.log(`Found ${tools.length} tools.`);

  // 2. Insert each analysis
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const a of analyses) {
    const toolId = toolMap[a.name];
    if (!toolId) {
      console.error(`  ✗ Tool "${a.name}" not found in DB, skipping`);
      errors++;
      continue;
    }

    const { data: existing } = await supabase
      .from('tool_analyses')
      .select('id')
      .eq('tool_id', toolId)
      .maybeSingle();

    if (existing) {
      console.log(`  → ${a.name}: already has analysis, skipping`);
      skipped++;
      continue;
    }

    const record = {
      tool_id: toolId,
      summary: a.summary,
      adoption_score: a.adoption_score,
      adoption_label: a.adoption_label,
      tool_rating_label: a.tool_rating_label,
      beginner_friendly_percentage: a.beginner_friendly_percentage,
      balanced_percentage: a.balanced_percentage,
      power_user_percentage: a.power_user_percentage,
      complexity_score: a.complexity_score,
      confidence: a.confidence,
      main_purpose: a.main_purpose,
      category: a.category,
      target_users: a.target_users,
      key_features: a.key_features,
      pros: a.pros,
      cons: a.cons,
      pricing_model: a.pricing_model,
      integrations: a.integrations,
      best_for: a.best_for,
      marketing_buzzwords: a.marketing_buzzwords,
      rating_notes: a.rating_notes,
      disclaimer: a.disclaimer,
      model: a.model
    };

    const { error } = await supabase
      .from('tool_analyses')
      .insert(record);

    if (error) {
      console.error(`  ✗ ${a.name}: insert error:`, error.message);
      errors++;
    } else {
      console.log(`  ✓ ${a.name}: analysis inserted`);
      inserted++;
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);

  // 3. Verify
  const { data: verify, error: verifyError } = await supabase
    .from('tools')
    .select(`
      name,
      tool_analyses!inner (
        category,
        tool_rating_label
      )
    `)
    .order('name');

  if (verifyError) {
    console.error('Verify error:', verifyError.message);
  } else {
    console.log(`\nVerification — ${verify.length} tools with analyses:`);
    for (const v of verify) {
      console.log(`  ${v.name}: ${v.tool_analyses[0].category} | ${v.tool_analyses[0].tool_rating_label}`);
    }
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
