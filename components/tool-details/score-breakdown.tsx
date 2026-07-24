interface ScoreBreakdownProps {
  scores?: {
    features: number
    performance: number
    easeOfUse: number
    community: number
    pricing: number
  }
}

export function ScoreBreakdown({ scores }: ScoreBreakdownProps) {
  // Default mock scores from reference design
  const defaultScores = {
    features: 23,
    performance: 25,
    easeOfUse: 20,
    community: 17,
    pricing: 15,
  }

  const data = scores || defaultScores

  const breakdown = [
    { label: 'Features', value: data.features, color: 'bg-[#6366F1]' },
    { label: 'Performance', value: data.performance, color: 'bg-[#10B981]' },
    { label: 'Ease of Use', value: data.easeOfUse, color: 'bg-[#3B82F6]' },
    { label: 'Community', value: data.community, color: 'bg-[#F59E0B]' },
    { label: 'Pricing', value: data.pricing, color: 'bg-[#EF4444]' },
  ]

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-elevated p-5">
      <h3 className="mb-4 text-lg font-semibold text-text-primary">Score Breakdown</h3>
      <div className="space-y-3">
        {breakdown.map((item) => (
          <div key={item.label}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm text-text-secondary">{item.label}</span>
              <span className="text-sm font-medium text-text-muted">{item.value}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-n-700">
              <div
                className={`h-full rounded-full ${item.color}`}
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
