import { describe, expect, it } from 'vitest'
import { RegistrationStatus } from '@prisma/client'
import { compareServantApplicationPriority } from '@/lib/servant-applications'

describe('servant application ordering', () => {
  it('puts pending applications before completed applications and keeps each group newest first', () => {
    const applications = [
      { id: 'approved-new', status: RegistrationStatus.APPROVED, createdAt: '2026-09-20T12:00:00Z' },
      { id: 'pending-old', status: RegistrationStatus.PENDING, createdAt: '2026-09-18T12:00:00Z' },
      { id: 'rejected-old', status: RegistrationStatus.REJECTED, createdAt: '2026-09-17T12:00:00Z' },
      { id: 'pending-new', status: RegistrationStatus.PENDING, createdAt: '2026-09-21T12:00:00Z' },
    ]

    expect(applications.sort(compareServantApplicationPriority).map(application => application.id))
      .toEqual(['pending-new', 'pending-old', 'approved-new', 'rejected-old'])
  })
})
