import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  findClass: vi.fn(),
  canViewClass: vi.fn(),
  canCoordinateClass: vi.fn(),
  canServeClass: vi.fn(),
  canTakeServantAttendance: vi.fn(),
  canDeleteClass: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: mocks.auth }))
vi.mock('@/lib/sunday-school-access', () => ({
  getSundaySchoolAccess: mocks.access,
  canViewClass: mocks.canViewClass,
  canCoordinateClass: mocks.canCoordinateClass,
  canServeClass: mocks.canServeClass,
  canTakeServantAttendance: mocks.canTakeServantAttendance,
  canDeleteClass: mocks.canDeleteClass,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    sundaySchoolClass: { findUnique: mocks.findClass },
  },
}))

import { GET } from '@/app/api/sunday-school/classes/[id]/route'

describe('Sunday School class detail API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ id: 'coordinator-1', role: 'SERVANT' })
    mocks.access.mockResolvedValue({ canRead: true })
    mocks.canViewClass.mockReturnValue(true)
    mocks.canCoordinateClass.mockReturnValue(true)
    mocks.canServeClass.mockReturnValue(true)
    mocks.canTakeServantAttendance.mockReturnValue(true)
    mocks.canDeleteClass.mockReturnValue(false)
    mocks.findClass.mockResolvedValue({
      id: 'class-1',
      name: 'Grade 3 Boys',
      level: 'GRADE_3',
      academicYearId: 'year-1',
      assignments: [],
      children: [],
      sessions: [],
      weeklyLessons: [],
    })
  })

  it('returns only active servant assignments after one is removed', async () => {
    const response = await GET(
      new Request('http://localhost/api/sunday-school/classes/class-1'),
      { params: Promise.resolve({ id: 'class-1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.findClass).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'class-1' },
      include: expect.objectContaining({
        assignments: expect.objectContaining({ where: { endedAt: null } }),
      }),
    }))
  })
})
