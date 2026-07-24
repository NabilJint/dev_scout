import type { ToolWithAnalysis } from '@/lib/supabase/types'

interface KeyFeaturesProps {
  tool: ToolWithAnalysis
}

export function KeyFeatures({ tool }: KeyFeaturesProps) {
  const analysis = tool.tool_analyses
  const features = analysis?.key_features || []

  // Split features into two columns
  const midpoint = Math.ceil(features.length / 2)
  const leftColumn = features.slice(0, midpoint)
  const rightColumn = features.slice(midpoint)

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-elevated p-6">
      <h2 className="mb-4 text-xl font-semibold text-text-primary">Key Features</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-3">
          {leftColumn.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-text-secondary">{feature}</span>
            </div>
          ))}
        </div>

        {/* Right Column */}
        <div className="space-y-3">
          {rightColumn.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-text-secondary">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
