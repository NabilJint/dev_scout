import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-elevated">
        <svg
          className="h-8 w-8 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </div>
      <h2 className="mb-2 text-2xl font-bold text-text-primary">Tool Not Found</h2>
      <p className="mb-6 max-w-md text-text-secondary">
        The tool you&apos;re looking for doesn&apos;t exist or has been removed. Try searching for another tool.
      </p>
      <Link href="/">
        <Button variant="default" className="bg-primary text-primary-foreground hover:bg-primary-hover">
          Back to Home
        </Button>
      </Link>
    </div>
  )
}
