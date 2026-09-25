import type { UserRole } from '@prisma/client'
import { canBeMentor } from '@/lib/roles'

export interface MentorCandidate {
  role: UserRole
  isDisabled: boolean
}

export function isEligibleMentorAccount(candidate: MentorCandidate | null): boolean {
  return Boolean(candidate && !candidate.isDisabled && canBeMentor(candidate.role))
}
