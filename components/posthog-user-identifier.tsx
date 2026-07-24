'use client'

import { useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import posthog from 'posthog-js'

export function PostHogUserIdentifier() {
  const { isLoaded, isSignedIn, user } = useUser()

  useEffect(() => {
    if (!isLoaded) return
    if (isSignedIn && user) {
      posthog.identify(user.id, {
        name: user.fullName ?? undefined,
        created_at: user.createdAt?.toISOString(),
      })
    }
  }, [isLoaded, isSignedIn, user])

  return null
}
