'use client'

import { useState } from 'react'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function NewsletterSection() {
  const [email, setEmail] = useState('')

  function handleSubscribe() {
    if (!email) return
    posthog.capture('newsletter_subscribed', { source: 'tool_detail' })
    setEmail('')
  }

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-elevated p-8">
      <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
        {/* Left: Text */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/20">
            <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              Stay ahead with developer tools insights
            </h3>
            <p className="text-sm text-text-secondary">
              Get the latest tools, AI analysis, and developer news delivered to your inbox.
            </p>
          </div>
        </div>

        {/* Right: Form */}
        <div className="flex w-full gap-3 md:w-auto">
          <Input
            type="email"
            placeholder="Enter your email"
            className="w-full md:w-64"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button
            variant="default"
            size="default"
            className="bg-primary text-primary-foreground hover:bg-primary-hover"
            onClick={handleSubscribe}
          >
            Subscribe
          </Button>
        </div>
      </div>
    </section>
  )
}
