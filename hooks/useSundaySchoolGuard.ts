'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

/**
 * Guards the Sunday School pages.
 *
 * Unlike useAdminGuard this is not a role check — Sunday School authority
 * comes from assignments, so it reads the coarse standing the session carries
 * (see lib/auth.ts). It decides only whether to show the section at all; every
 * actual permission is re-derived server-side per class.
 *
 * Redirects to /login when signed out and to /dashboard when the user has no
 * Sunday School standing.
 */
export function useSundaySchoolGuard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const hasAccess = session?.user?.sundaySchool?.hasAccess ?? false

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && !hasAccess) {
      router.push('/dashboard')
    }
  }, [status, hasAccess, router])

  return { session, status, hasAccess }
}
