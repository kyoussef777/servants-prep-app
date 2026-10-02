'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { X, Camera } from 'lucide-react'

const LEGACY_DISMISS_KEY = 'profile-photo-reminder-dismissed'

function getDismissKey(userId: string) {
  return `profile-photo-reminder-dismissed:${userId}`
}

export function ProfilePhotoReminder() {
  const { data: session, status } = useSession()
  const [dismissed, setDismissed] = useState(true) // default hidden to avoid flash
  const userId = session?.user?.id
  const isViewingAs = Boolean(session?.impersonating)

  useEffect(() => {
    // Dismissals used to be permanent and shared by every account using this
    // browser. Remove that preference so the reminder returns as intended.
    try {
      localStorage.removeItem(LEGACY_DISMISS_KEY)
    } catch {
      // Storage can be unavailable in privacy-restricted browsers.
    }

    if (status !== 'authenticated' || !userId) {
      setDismissed(true)
      return
    }

    // View as is read-only, so an administrator should never be able to hide a
    // reminder on behalf of the student they are viewing.
    if (isViewingAs) {
      setDismissed(false)
      return
    }

    try {
      setDismissed(sessionStorage.getItem(getDismissKey(userId)) === 'true')
    } catch {
      setDismissed(false)
    }
  }, [isViewingAs, status, userId])

  if (status !== 'authenticated') return null
  if (!session?.user) return null

  // Only show for students
  if (session.user.role !== 'STUDENT') return null

  // Already has a profile photo - don't show
  if (session.user.profileImageUrl) return null

  // User dismissed the reminder
  if (dismissed) return null

  const handleDismiss = () => {
    if (isViewingAs) return

    try {
      sessionStorage.setItem(getDismissKey(session.user.id), 'true')
    } catch {
      // Still hide it for the current render if storage is unavailable.
    }
    setDismissed(true)
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3">
        <Camera className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800 dark:text-amber-200 flex-1">
          Add a profile photo so your mentors and servants can recognize you.{' '}
          <Link href="/settings" className="font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100">
            Go to Settings
          </Link>
        </p>
        {!isViewingAs && (
          <button
            onClick={handleDismiss}
            className="p-1 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 shrink-0"
            aria-label="Dismiss reminder"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
