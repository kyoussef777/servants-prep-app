import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoleTag, UserRole } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: mocks.auth }))
vi.mock('@/lib/sunday-school-access', () => ({
  getSundaySchoolAccess: mocks.access,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: mocks.findMany },
  },
}))

import { GET } from '@/app/api/sunday-school/assignable-servants/route'

describe('Sunday School assignable servant picker', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ id: 'admin-1', role: UserRole.SUPER_ADMIN })
    mocks.access.mockResolvedValue({
      isAdmin: true,
      coordinatorClassIds: new Set<string>(),
      coordinatorAgeGroupIds: new Set<string>(),
    })
    mocks.findMany.mockResolvedValue([])
  })

  it('includes super admins only when their Sunday School Servant tag is active', async () => {
    const response = await GET(new Request(
      'http://localhost/api/sunday-school/assignable-servants?search=admin'
    ))

    expect(response.status).toBe(200)
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        isDisabled: false,
        OR: [
          { role: { in: [UserRole.SERVANT, UserRole.MENTOR, UserRole.SERVANT_PREP] } },
          {
            role: UserRole.SUPER_ADMIN,
            roleAssignments: {
              some: {
                tag: RoleTag.SUNDAY_SCHOOL_SERVANT,
                revokedAt: null,
              },
            },
          },
        ],
        name: { contains: 'admin', mode: 'insensitive' },
      },
    }))
  })

  it('does not expose the picker to someone without staffing authority', async () => {
    mocks.access.mockResolvedValue({
      isAdmin: false,
      coordinatorClassIds: new Set<string>(),
      coordinatorAgeGroupIds: new Set<string>(),
    })

    const response = await GET(new Request(
      'http://localhost/api/sunday-school/assignable-servants'
    ))

    expect(response.status).toBe(403)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})
