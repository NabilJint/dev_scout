import type { ToolWithAnalysis } from '@/lib/supabase/types'

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
