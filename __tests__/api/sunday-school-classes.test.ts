import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  findClass: vi.fn(),
  findFirstClass: vi.fn(),
  updateClass: vi.fn(),
  transaction: vi.fn(),
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
    sundaySchoolClass: {
      findUnique: mocks.findClass,
      findFirst: mocks.findFirstClass,
    },
    $transaction: mocks.transaction,
  },
}))

import { GET, PATCH } from '@/app/api/sunday-school/classes/[id]/route'

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
    mocks.findFirstClass.mockResolvedValue(null)
    mocks.updateClass.mockResolvedValue({
      id: 'class-1',
      name: 'Middle School Boys',
      level: 'GRADE_6',
      academicYearId: 'year-1',
      assignments: [],
      _count: { children: 0, sessions: 0 },
    })
    mocks.transaction.mockImplementation(async callback => callback({
      sundaySchoolClass: { update: mocks.updateClass },
    }))
    mocks.findClass.mockResolvedValue({
      id: 'class-1',
      name: 'Middle School',
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

  it('trims and updates a class name for a coordinator', async () => {
    const response = await PATCH(
      new Request('http://localhost/api/sunday-school/classes/class-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: '  Middle School Boys  ' }),
      }),
      { params: Promise.resolve({ id: 'class-1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.updateClass).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'class-1' },
      data: { name: 'Middle School Boys' },
    }))
  })

  it('returns a clear conflict when another class already uses the name', async () => {
    mocks.findFirstClass.mockResolvedValue({ id: 'class-2' })

    const response = await PATCH(
      new Request('http://localhost/api/sunday-school/classes/class-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Existing Class' }),
      }),
      { params: Promise.resolve({ id: 'class-1' }) }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'A class with this name already exists for that academic year',
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
