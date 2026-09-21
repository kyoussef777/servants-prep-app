import type { UserRole } from '@prisma/client'

export function defaultDashboardPath(role?: UserRole | null): string {
  switch (role) {
    case 'STUDENT':
      return '/dashboard/student'
    case 'MENTOR':
      return '/dashboard/mentor'
    case 'SERVANT':
      return '/dashboard/servants'
    case 'PARENT':
      return '/dashboard/parent'
    case 'SERVANT_PREP':
    case 'PRIEST':
    case 'SUPER_ADMIN':
      return '/dashboard/admin'
    default:
      return '/login'
  }
}
