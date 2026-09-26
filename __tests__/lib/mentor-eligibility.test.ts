import { describe, expect, it } from 'vitest'
import { UserRole } from '@prisma/client'
import { isEligibleMentorAccount } from '@/lib/mentor-eligibility'

describe('mentor account eligibility', () => {
  it('allows an active priest to be assigned as a mentor', () => {
    expect(isEligibleMentorAccount({
      role: UserRole.PRIEST,
      isDisabled: false,
    })).toBe(true)
  })

  it('rejects disabled accounts and ineligible roles', () => {
    expect(isEligibleMentorAccount({
      role: UserRole.PRIEST,
      isDisabled: true,
    })).toBe(false)
    expect(isEligibleMentorAccount({
      role: UserRole.STUDENT,
      isDisabled: false,
    })).toBe(false)
    expect(isEligibleMentorAccount(null)).toBe(false)
  })
})
