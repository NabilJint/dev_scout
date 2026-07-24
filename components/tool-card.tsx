'use client'

import React from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'
import type { ToolWithAnalysis } from '@/lib/supabase/types'
import { toolSourceCounts } from '@/lib/mock-data'
import { categoryColors, categoryGradients, toolGradientOverrides } from '@/lib/constants'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'

interface ToolCardProps {
  tool: ToolWithAnalysis
}

const toolLogoConfig: Record<string, { bg: string; letter: string; letterColor: string; iconBg: string }> = {
  'Cursor':     { bg: '#000',   letter: '>', letterColor: '#a78bfa', iconBg: '#7c3aed' },
  'Supabase':   { bg: '#1c1c1c', letter: 'S', letterColor: '#3ecf8e', iconBg: '#3ecf8e' },
  'Clerk':      { bg: '#f97316', letter: 'C', letterColor: '#fff', iconBg: '#f97316' },
  'Vercel':     { bg: '#000',   letter: 'V', letterColor: '#fff', iconBg: '#000' },
  'Resend':     { bg: '#000',   letter: 'R', letterColor: '#fff', iconBg: '#000' },
  'Neon':       { bg: '#0c0c0c', letter: 'N', letterColor: '#00e599', iconBg: '#00e599' },
  'Sentry':     { bg: '#362d59', letter: 'S', letterColor: '#e54545', iconBg: '#e54545' },
  'Convex':     { bg: '#1a1a2e', letter: 'C', letterColor: '#00b4d8', iconBg: '#00b4d8' },
  'Prisma':     { bg: '#1a1a2e', letter: 'P', letterColor: '#5a67d8', iconBg: '#5a67d8' },
  'PlanetScale':{ bg: '#000',   letter: 'P', letterColor: '#e2e8f0', iconBg: '#e2e8f0' },
  'Railway':    { bg: '#000',   letter: 'R', letterColor: '#e2e8f0', iconBg: '#e2e8f0' },
  'Cloudflare': { bg: '#f48120', letter: 'CF', letterColor: '#fff', iconBg: '#f48120' },
}

// Brand text configuration per tool
const brandTextConfig: Record<string, { text: string; fontFamily: string; fontSize: string; fontWeight: string; letterSpacing?: string }> = {
  'Vercel':      { text: 'Vercel',      fontFamily: 'sans-serif', fontSize: '28px', fontWeight: '700' },
  'Resend':      { text: 'Resend',      fontFamily: 'sans-serif', fontSize: '28px', fontWeight: '700' },
  'Neon':        { text: 'NEON',        fontFamily: 'monospace',  fontSize: '30px', fontWeight: '800', letterSpacing: '2px' },
  'Sentry':      { text: 'Sentry',      fontFamily: 'sans-serif', fontSize: '26px', fontWeight: '700' },
  'Convex':      { text: 'convex',      fontFamily: 'sans-serif', fontSize: '28px', fontWeight: '600' },
  'Prisma':      { text: 'Prisma',      fontFamily: 'sans-serif', fontSize: '28px', fontWeight: '700' },
  'PlanetScale': { text: 'PlanetScale', fontFamily: 'sans-serif', fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px' },
  'Railway':     { text: 'Railway',     fontFamily: 'sans-serif', fontSize: '28px', fontWeight: '700' },
  'Cloudflare':  { text: 'CLOUDFLARE',  fontFamily: 'sans-serif', fontSize: '20px', fontWeight: '800', letterSpacing: '2px' },
}

// Tool-specific logo SVGs (no white container, direct on gradient, scaled to ~100px)
function BannerLogo({ name, brandText, imageUrl }: { name: string; brandText?: string | null; imageUrl?: string | null }) {
  const [imgError, setImgError] = React.useState(false)
  // Priority 1: If imageUrl is truthy and non-empty, render an <img> tag
  if (imageUrl && imageUrl.trim().length > 0 && !imgError) {
    return (
      <div className="flex items-center justify-center drop-shadow-lg">
        <img
          src={imageUrl}
          alt={`${name} logo`}
          className="h-24 w-24 object-contain"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  const config = toolLogoConfig[name] || { bg: '#374151', letter: name.charAt(0), letterColor: '#fff', iconBg: '#6b7280' }
  const brand = brandTextConfig[name]

  // Tool-specific SVG logos scaled up to 100x100
  const toolSvgs: Record<string, React.ReactElement> = {
    'Cursor': (
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
        <path d="M50 8L84 42L50 76L16 42L50 8Z" fill="#a78bfa" fillOpacity="0.3"/>
        <path d="M50 20L70 42L50 64L30 42L50 20Z" fill="#a78bfa"/>
      </svg>
    ),
    'Supabase': (
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="34" fill="#3ecf8e" fillOpacity="0.15"/>
        <path d="M33 58V42L50 26L67 42V58L50 74L33 58Z" fill="#3ecf8e"/>
      </svg>
    ),
    'Clerk': (
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="34" fill="#f97316" fillOpacity="0.15"/>
        <path d="M50 24C35.1 24 23 36.1 23 51S35.1 78 50 78S77 65.9 77 51" stroke="#f97316" strokeWidth="4" fill="none"/>
        <circle cx="50" cy="51" r="8" fill="#f97316"/>
      </svg>
    ),
    'Vercel': (
      <svg width="60" height="52" viewBox="0 0 60 52" fill="none">
        <path d="M0 52L30 0L60 52H0Z" fill="white"/>
      </svg>
    ),
    'Resend': (
      <svg width="100" height="72" viewBox="0 0 100 72" fill="none">
        <rect x="4" y="14" width="92" height="44" rx="6" fill="white" fillOpacity="0.9"/>
        <path d="M4 14L50 50L96 14" stroke="white" strokeWidth="3" fill="none"/>
      </svg>
    ),
    'Neon': (
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="34" fill="#00e599" fillOpacity="0.12"/>
        <text x="50" y="62" textAnchor="middle" fontFamily="monospace" fontWeight="bold" fontSize="50" fill="#00e599">N</text>
      </svg>
    ),
    'Sentry': (
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="34" fill="#e54545" fillOpacity="0.15"/>
        <path d="M38 30V70L50 62L62 70V30" stroke="#e54545" strokeWidth="4" fill="none"/>
      </svg>
    ),
    'Convex': (
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="34" fill="#00b4d8" fillOpacity="0.12"/>
        <path d="M33 70L50 30L67 70" stroke="#00b4d8" strokeWidth="4" fill="none"/>
      </svg>
    ),
    'Prisma': (
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="34" fill="#5a67d8" fillOpacity="0.12"/>
        <path d="M42 22V78L58 70V14" stroke="#5a67d8" strokeWidth="4" fill="none"/>
      </svg>
    ),
    'PlanetScale': (
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="34" fill="#e2e8f0" fillOpacity="0.1"/>
        <circle cx="50" cy="50" r="18" stroke="#e2e8f0" strokeWidth="2.5" fill="none"/>
        <circle cx="50" cy="50" r="7" fill="#e2e8f0"/>
      </svg>
    ),
    'Railway': (
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="34" fill="#e2e8f0" fillOpacity="0.1"/>
        <path d="M28 60H72L64 38H36L28 60Z" fill="#e2e8f0"/>
        <rect x="36" y="42" width="10" height="14" fill="#1a1a2e"/>
        <rect x="54" y="42" width="10" height="14" fill="#1a1a2e"/>
      </svg>
    ),
    'Cloudflare': (
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="34" fill="#f48120" fillOpacity="0.12"/>
        <path d="M30 58C23.2 58 18 52.8 18 46C18 40 22 34.8 26.4 33.8C28.4 25.6 36 20 44.8 21C52 21.8 58 27.8 58.8 35C64.8 35 70 40 70 46C70 52.8 64.8 58 58 58H30Z" fill="#f48120"/>
      </svg>
    ),
  }

  const svg = toolSvgs[name]

  if (brand && brandText) {
    // Show icon + brand text side by side
    return (
      <div className="flex items-center justify-center gap-3 drop-shadow-lg">
        {svg && <div className="flex-shrink-0">{svg}</div>}
        <span
          className="whitespace-nowrap text-white drop-shadow-md"
          style={{
            fontFamily: brand.fontFamily,
            fontSize: brand.fontSize,
            fontWeight: brand.fontWeight,
            letterSpacing: brand.letterSpacing,
            textShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {brand.text}
        </span>
      </div>
    )
  }

  if (svg) {
    return (
      <div className="flex items-center justify-center drop-shadow-lg">
        {svg}
      </div>
    )
  }

  // Fallback: large letter in rounded rect (no white container)
  return (
    <div
      className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl drop-shadow-lg"
      style={{ backgroundColor: config.bg }}
    >
      <span
        className="font-bold leading-none"
        style={{
          color: config.letterColor,
          fontSize: name === 'Cloudflare' ? '22px' : '36px',
          fontFamily: name === 'Neon' ? 'monospace' : 'sans-serif',
        }}
      >
        {config.letter}
      </span>
    </div>
  )
}

function SmallAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const [imgError, setImgError] = React.useState(false)
  // If imageUrl is available, render a small logo image
  if (imageUrl && imageUrl.trim().length > 0 && !imgError) {
    return (
      <img
        src={imageUrl}
        alt={`${name} logo`}
        className="h-6 w-6 flex-shrink-0 rounded-full object-contain"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
      />
    )
  }
  // Fall back to letter
  const config = toolLogoConfig[name] || { iconBg: '#6b7280', letter: name.charAt(0), letterColor: '#fff' }
  return (
    <div
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ backgroundColor: config.iconBg }}
    >
      {name.charAt(0)}
    </div>
  )
}

export function ToolCard({ tool }: ToolCardProps) {
  const analysis = tool.tool_analyses
  const source = tool.tool_sources
  const category = analysis?.category || 'Uncategorized'
  const gradient = toolGradientOverrides[tool.name] || categoryGradients[category] || 'linear-gradient(135deg, #374151, #4b5563)'
  const badgeColor = categoryColors[category] || '#6b7280'
  const sourceCount = toolSourceCounts[tool.id] || 1

  return (
    <Link
      href={`/tools/${tool.id}`}
      className="block group"
      onClick={() =>
        posthog.capture('tool_card_clicked', {
          tool_id: tool.id,
          tool_name: tool.name,
          category: category,
          source: source?.name,
        })
      }
    >
    <Card className="group flex flex-col rounded-xl border border-[#1f2937] bg-[#111827] py-0 gap-0 transition-all duration-200 hover:border-[#374151] hover:shadow-lg overflow-hidden">
      {/* Gradient Banner */}
      <CardHeader className="relative h-[140px] w-full overflow-hidden !p-0" style={{ background: gradient }}>
        {/* Category Badge */}
        <span
          className="absolute left-3 top-3 rounded-md px-2 py-0.5 text-[11px] font-medium text-white"
          style={{ backgroundColor: `${badgeColor}cc` }}
        >
          {category}
        </span>

        {/* Info Icon - border only, no fill */}
        <button
          className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border border-white/30 bg-transparent text-[12px] font-semibold text-white/70 hover:text-white hover:border-white/50 transition-colors"
          aria-label="More info"
          onClick={(e) => e.stopPropagation()}
        >
          i
        </button>

        {/* Tool Logo - directly on gradient, no white container */}
        <div className="absolute inset-0 flex items-center justify-center">
          <BannerLogo name={tool.name} brandText={tool.brand_text} imageUrl={tool.image_url} />
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col p-4">
        {/* Tool Name with small icon */}
        <div className="mb-0.5 flex items-center gap-2">
          <SmallAvatar name={tool.name} imageUrl={tool.image_url} />
          <h3 className="text-[15px] font-semibold text-[#f9fafb]">{tool.name}</h3>
        </div>

        {/* Subtitle */}
        <p className="mb-1.5 text-xs text-[#9ca3af]">{analysis?.subtitle || source.name}</p>

        {/* Description */}
        <p className="mb-3 line-clamp-2 text-[13px] leading-[1.5] text-[#9ca3af]">
          {analysis?.summary || 'No description available.'}
        </p>

        {/* Rating Badges */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          <RatingBadge label="Excellent" percentage={analysis?.beginner_friendly_percentage || 0} bgColor="#059669" />
          <RatingBadge label="Average" percentage={analysis?.balanced_percentage || 0} bgColor="#d97706" />
          <RatingBadge label="Poor" percentage={analysis?.power_user_percentage || 0} bgColor="#dc2626" />
        </div>
      </CardContent>

      <CardFooter className="mt-auto flex items-center justify-between border-t border-[#1f2937] px-4 pt-2.5 pb-4 bg-transparent">
        <span className="text-xs text-[#9ca3af]">{sourceCount} sources</span>
        <span className="text-xs text-[#9ca3af]">Updated {formatTimeAgo(tool.last_updated)}</span>
      </CardFooter>
    </Card>
    </Link>
  )
}

function RatingBadge({ label, percentage, bgColor }: { label: string; percentage: number; bgColor: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
      style={{ backgroundColor: bgColor }}
    >
      {label} {percentage}%
    </span>
  )
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 172800) return 'yesterday'
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`
  return `${Math.floor(diffInSeconds / 2592000)}mo ago`
}
