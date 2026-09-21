import type { RegistrationStatus } from '@prisma/client'

interface PrioritizableServantApplication {
  status: RegistrationStatus
  createdAt: string
}

/** Pending applications first, then completed applications; newest first within each group. */
export function compareServantApplicationPriority(
  left: PrioritizableServantApplication,
  right: PrioritizableServantApplication
): number {
  const leftPriority = left.status === 'PENDING' ? 0 : 1
  const rightPriority = right.status === 'PENDING' ? 0 : 1
  if (leftPriority !== rightPriority) return leftPriority - rightPriority

  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
}
