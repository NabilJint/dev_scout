interface SourceBreakdownProps {
  sources?: {
    total: number
    topReviews: number
    officialDocs: number
    community: number
    newsAndBlogs: number
  }
}

export function SourceBreakdown({ sources }: SourceBreakdownProps) {
  // Default mock data from reference design
  const defaultSources = {
    total: 18,
    topReviews: 8,
    officialDocs: 4,
    community: 3,
    newsAndBlogs: 3,
  }

  const data = sources || defaultSources

  const breakdown = [
    { label: 'Top Reviews', count: data.topReviews, color: 'bg-[#6366F1]' },
    { label: 'Official Docs', count: data.officialDocs, color: 'bg-[#3B82F6]' },
    { label: 'Community', count: data.community, color: 'bg-[#10B981]' },
    { label: 'News & Blogs', count: data.newsAndBlogs, color: 'bg-[#F59E0B]' },
  ]

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-elevated p-5">
      <h3 className="mb-1 text-lg font-semibold text-text-primary">Source Breakdown</h3>
      <p className="mb-4 text-sm text-text-muted">{data.total} Total Sources</p>

      <div className="space-y-3">
        {breakdown.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-4 w-4 rounded-sm ${item.color}`} />
              <span className="text-sm text-text-secondary">{item.label}</span>
            </div>
            <span className="text-sm text-text-muted">
              {item.count} ({Math.round((item.count / data.total) * 100)}%)
            </span>
          </div>
        ))}
      </div>

      <button className="mt-4 w-full rounded-lg border border-border-subtle bg-n-700 py-2.5 text-sm font-medium text-text-primary hover:bg-n-600 transition-colors">
        View All Sources
      </button>
    </div>
  )
}
