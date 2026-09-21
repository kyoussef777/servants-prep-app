import type { ReactNode } from 'react'
import { RoleTag } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AuthorizationError, getAuthorizationContext } from '@/lib/authorization'

export default async function ActivityLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  try {
    const authorization = await getAuthorizationContext(session.user.id)
    if (authorization.disabled || !authorization.roleTags.has(RoleTag.SUPER_ADMIN)) {
      redirect('/dashboard')
    }
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/login')
    throw error
  }

  return children
}
