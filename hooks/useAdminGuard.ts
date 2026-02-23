'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { UserRole } from '@prisma/client'

type RoleCheck = (role: UserRole) => boolean

/**
 * Hook that redirects unauthenticated users to /login
 * and unauthorized users to /dashboard.
 *
 * Returns { session, status } from useSession.
 */
export function useAdminGuard(roleCheck: RoleCheck) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (
      status === 'authenticated' &&
      session?.user?.role &&
      !roleCheck(session.user.role as UserRole)
    ) {
      router.push('/dashboard')
    }
  }, [status, session, router, roleCheck])

  return { session, status }
}
