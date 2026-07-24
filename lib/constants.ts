// lib/constants.ts
// Category-to-color mapping for badges
export const categoryColors: Record<string, string> = {
  'All': '#3b82f6',
  'AI Tools': '#7c3aed',
  'AI Coding': '#7c3aed',
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
  'Email': '#7c3aed',
  'Monitoring': '#15803d',
  'ORM': '#1d4ed8',
}

// Category-to-gradient mapping for card banners
export const categoryGradients: Record<string, string> = {
  'All': 'linear-gradient(135deg, #3b82f6, #60a5fa)',
  'AI Tools': 'linear-gradient(135deg, #7c3aed, #a855f7)',
  'AI Coding': 'linear-gradient(135deg, #1a1a2e, #2d1b69)',
  'Developer Tools': 'linear-gradient(135deg, #3b82f6, #60a5fa)',
  'Backend': 'linear-gradient(135deg, #0a1628, #1a3a2a)',
  'Frontend': 'linear-gradient(135deg, #7c3aed, #c084fc)',
  'Database': 'linear-gradient(135deg, #0c1a1a, #0d3b3b)',
  'DevOps': 'linear-gradient(135deg, #1a1a2e, #2d1b69)',
  'Productivity': 'linear-gradient(135deg, #ca8a04, #facc15)',
  'Security': 'linear-gradient(135deg, #dc2626, #f87171)',
  'Cloud': 'linear-gradient(135deg, #d97706, #fbbf24)',
  'Authentication': 'linear-gradient(135deg, #0a1628, #1a2a3a)',
  'Deployment': 'linear-gradient(135deg, #0f1923, #1a2a3a)',
  'Email': 'linear-gradient(135deg, #2d1b69, #4c1d95)',
  'Monitoring': 'linear-gradient(135deg, #1a1040, #2d1b69)',
  'ORM': 'linear-gradient(135deg, #1a1a2e, #2d1b69)',
}

// Tool-specific gradient overrides (tool name → gradient)
// Used when tool-specific colors differ from category defaults
export const toolGradientOverrides: Record<string, string> = {
  'Cursor': 'linear-gradient(135deg, #1a1a2e, #2d1b69)',
  'Supabase': 'linear-gradient(135deg, #0a1628, #1a3a2a)',
  'Clerk': 'linear-gradient(135deg, #0a1628, #1a2a3a)',
  'Vercel': 'linear-gradient(135deg, #0f1923, #1a2a3a)',
  'Resend': 'linear-gradient(135deg, #2d1b69, #4c1d95)',
  'Neon': 'linear-gradient(135deg, #0c1a1a, #0d3b3b)',
  'Sentry': 'linear-gradient(135deg, #1a1040, #2d1b69)',
  'Convex': 'linear-gradient(135deg, #0a1628, #1a3a2a)',
  'Prisma': 'linear-gradient(135deg, #1a1a2e, #2d1b69)',
  'PlanetScale': 'linear-gradient(135deg, #0f1923, #1a2a3a)',
  'Railway': 'linear-gradient(135deg, #0f1923, #1a2a3a)',
  'Cloudflare': 'linear-gradient(135deg, #d97706, #fbbf24)',
}

// Category-to-icon-name mapping for filter pills
export const categoryIcons: Record<string, string> = {
  'All': 'grid',
  'AI Tools': 'sparkles',
  'AI Coding': 'sparkles',
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
