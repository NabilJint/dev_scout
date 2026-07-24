interface AIConfidenceProps {
  confidence?: number
}

export function AIConfidence({ confidence = 0.92 }: AIConfidenceProps) {
  const percentage = Math.round(confidence * 100)
  const circumference = 2 * Math.PI * 54
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-elevated p-5">
      <h3 className="mb-4 text-lg font-semibold text-text-primary">AI Confidence</h3>

      {/* Circular Gauge */}
      <div className="mb-4 flex justify-center">
        <div className="relative h-36 w-36">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            {/* Background circle */}
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-n-700"
            />
            {/* Progress circle */}
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="text-primary transition-all duration-500"
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-text-primary">{percentage}%</span>
          </div>
        </div>
      </div>

      {/* Label */}
      <div className="text-center">
        <span className="text-sm font-medium text-positive">High Confidence</span>
      </div>

      {/* Description */}
      <p className="mt-3 text-center text-xs leading-relaxed text-text-muted">
        Our AI has high confidence in this analysis based on comprehensive source evaluation.
      </p>

      {/* How we calculate link */}
      <div className="mt-4 text-center">
        <button className="text-xs text-text-muted hover:text-text-secondary">
          How we calculate confidence →
        </button>
      </div>
    </div>
  )
}
