export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-elevated">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
          <path d="M4 8h24M4 16h24M4 24h24" strokeLinecap="round" />
          <circle cx="8" cy="8" r="2" fill="currentColor" />
          <circle cx="16" cy="16" r="2" fill="currentColor" />
          <circle cx="24" cy="24" r="2" fill="currentColor" />
        </svg>
      </div>
      <h3 className="mb-2 text-lg font-semibold text-text-primary">No tools found</h3>
      <p className="max-w-md text-sm text-text-secondary">
        There are no developer tools available yet. Check back later or try a different category.
      </p>
    </div>
  )
}
