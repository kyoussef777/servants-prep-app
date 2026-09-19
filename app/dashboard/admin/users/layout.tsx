import type { ReactNode } from 'react'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { RoleTag, UserRole } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function UsersLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    redirect('/dashboard')
  }

  const activeSuperAdminGrant = await prisma.userRoleAssignment.findFirst({
    where: {
      userId: session.user.id,
      tag: RoleTag.SUPER_ADMIN,
      revokedAt: null,
      user: { isDisabled: false },
    },
    select: { id: true },
  })

  if (!activeSuperAdminGrant) {
    redirect('/dashboard')
  }

  return children
}
