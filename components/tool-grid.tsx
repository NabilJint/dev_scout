import { ToolCard } from '@/components/tool-card'
import type { ToolWithAnalysis } from '@/lib/supabase/types'

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
