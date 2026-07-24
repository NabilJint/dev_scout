import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import type { ToolWithAnalysis } from '@/lib/supabase/types'

interface HeroSectionProps {
  tool: ToolWithAnalysis
}

export function HeroSection({ tool }: HeroSectionProps) {
  const analysis = tool.tool_analyses

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Left: Tool Info */}
      <div className="flex-1">
        {/* Tool Icon */}
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-n-700">
          <Image
            src={tool.image_url}
            alt={`${tool.name} logo`}
            width={64}
            height={64}
            className="h-16 w-16 rounded-xl object-contain"
            unoptimized
          />
        </div>

        {/* Category Badge */}
        <Badge variant="default" className="mb-4 bg-primary text-primary-foreground">
          {analysis?.category || 'Uncategorized'}
        </Badge>

        {/* Tool Name */}
        <h1 className="mb-3 text-4xl font-bold text-text-primary lg:text-5xl">
          {tool.name} – {analysis?.main_purpose || 'Developer Tool'}
        </h1>

        {/* Description */}
        <p className="mb-5 text-base leading-relaxed text-text-secondary lg:text-lg">
          {analysis?.summary || 'No description available.'}
        </p>

        {/* Author and Meta */}
        <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-text-muted">
          <span>By DevScout AI Team</span>
          <span className="text-n-600">·</span>
          <span>
            {new Date(tool.last_updated).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <span className="text-n-600">·</span>
          <span>12 min read</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-transparent px-3 py-1.5 text-sm text-text-secondary hover:bg-n-700 hover:text-text-primary transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            Save
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-transparent px-3 py-1.5 text-sm text-text-secondary hover:bg-n-700 hover:text-text-primary transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
            Bookmark
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-transparent px-3 py-1.5 text-sm text-text-secondary hover:bg-n-700 hover:text-text-primary transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            Share
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-n-700 hover:text-text-primary transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
