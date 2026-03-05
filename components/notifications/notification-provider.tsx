'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { registerServiceWorker, subscribeToPush, getPushPermissionState } from '@/lib/push-client'

/**
 * Registers the service worker and auto-subscribes to push if permission was previously granted.
 * Renders nothing visible - just handles setup.
 */
export function NotificationProvider() {
  const { data: session } = useSession()

  useEffect(() => {
    if (!session?.user) return

    // Register service worker
    registerServiceWorker().then((registration) => {
      if (!registration) return

      // If user already granted notification permission, auto-subscribe
      const { supported, permission } = getPushPermissionState()
      if (supported && permission === 'granted') {
        subscribeToPush()
      }
    })
  }, [session])

  return null
}
