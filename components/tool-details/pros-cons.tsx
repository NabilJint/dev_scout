import type { ToolWithAnalysis } from '@/lib/supabase/types'

interface ProsConsProps {
  tool: ToolWithAnalysis
}

export function ProsCons({ tool }: ProsConsProps) {
  const analysis = tool.tool_analyses
  const pros = analysis?.pros || []
  const cons = analysis?.cons || []

  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Pros */}
      <div className="rounded-xl border border-border-subtle bg-surface-elevated p-6">
        <h2 className="mb-4 text-xl font-semibold text-positive">Pros</h2>
        <div className="space-y-3">
          {pros.map((pro, index) => (
            <div key={index} className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-positive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-text-secondary">{pro}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cons */}
      <div className="rounded-xl border border-border-subtle bg-surface-elevated p-6">
        <h2 className="mb-4 text-xl font-semibold text-negative">Cons</h2>
        <div className="space-y-3">
          {cons.map((con, index) => (
            <div key={index} className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-negative"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-sm text-text-secondary">{con}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
