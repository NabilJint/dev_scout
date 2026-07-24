import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { ToolWithAnalysis } from '@/lib/supabase/types'

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
          const score = (8.5 + (tool.id.charCodeAt(0) % 15) / 10).toFixed(1)

          return (
            <Link
              key={tool.id}
              href={`/tools/${tool.id}`}
              className="flex w-52 flex-shrink-0 flex-col rounded-xl border border-border-subtle bg-n-700 p-4 transition-all hover:border-border-default"
            >
              {/* Category Badge */}
              <Badge variant="default" className="mb-3 w-fit bg-primary text-primary-foreground text-xs">
                {analysis?.category || 'Tool'}
              </Badge>

              {/* Tool Icon */}
              <div className="mb-3 flex h-14 items-center justify-center">
                <Image
                  src={tool.image_url}
                  alt={`${tool.name} logo`}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-xl object-contain"
                  unoptimized
                />
              </div>

              {/* Tool Name */}
              <h3 className="mb-1 text-sm font-semibold text-text-primary">{tool.name}</h3>

              {/* Description */}
              <p className="mb-3 line-clamp-2 text-xs text-text-muted">
                {analysis?.summary?.substring(0, 80) || 'Developer tool'}...
              </p>

              {/* Score */}
              <div className="mt-auto flex items-center gap-1.5 text-xs text-text-secondary">
                <svg
                  className="h-4 w-4 text-positive"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="font-medium">{score}/10</span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
