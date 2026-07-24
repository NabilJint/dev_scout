import { toolSourceCounts } from '@/lib/mock-data'
import type { ToolWithAnalysis } from '@/lib/supabase/types'

interface AIScoreCardProps {
  tool: ToolWithAnalysis
}

export function AIScoreCard({ tool }: AIScoreCardProps) {
  const sourceCount = toolSourceCounts[tool.id] || 18
  // Calculate a mock score based on confidence
  const mockScore = 9.1
  const scoreLabel = mockScore >= 8 ? 'Excellent' : mockScore >= 6 ? 'Good' : 'Average'
  const scoreColor = mockScore >= 8 ? 'text-positive' : mockScore >= 6 ? 'text-warning' : 'text-negative'

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">AI Tool Score</h3>
        <button className="text-text-muted hover:text-text-secondary" aria-label="More info">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="10" cy="10" r="8.5" />
            <path d="M10 9v5M10 7v0" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Score Display */}
      <div className="mb-2 flex items-baseline gap-1">
        <span className="text-5xl font-bold text-text-primary">{mockScore}</span>
        <span className="text-2xl text-text-muted">/10</span>
      </div>

      {/* Score Label */}
      <div className="mb-4 flex items-center gap-2">
        <span className={`text-sm font-medium ${scoreColor}`}>
          <span className="mr-1">●</span>
          {scoreLabel}
        </span>
      </div>

      {/* Score Bar */}
      <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-n-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-positive via-warning to-negative"
          style={{ width: `${(mockScore / 10) * 100}%` }}
        />
      </div>

      {/* Source Count */}
      <p className="text-xs text-text-muted">Based on {sourceCount} analyzed sources</p>
    </div>
  )
}
