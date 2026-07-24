import type { ToolWithAnalysis } from '@/lib/supabase/types'

interface ToolInformationProps {
  tool: ToolWithAnalysis
}

export function ToolInformation({ tool }: ToolInformationProps) {
  const analysis = tool.tool_analyses
  const source = tool.tool_sources

  const info = [
    { label: 'Developer', value: source.name },
    { label: 'Launched', value: '2023' },
    { label: 'Pricing', value: analysis?.pricing_model === 'freemium' ? 'Free / Pro / Team' : analysis?.pricing_model || 'Unknown' },
    { label: 'Platforms', value: 'macOS, Windows, Linux' },
    { label: 'Languages', value: 'All Major Languages' },
  ]

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-elevated p-5">
      <h3 className="mb-4 text-lg font-semibold text-text-primary">Tool Information</h3>
      <div className="space-y-3">
        {info.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-sm text-text-muted">{item.label}</span>
            <span className="text-sm font-medium text-text-primary">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
