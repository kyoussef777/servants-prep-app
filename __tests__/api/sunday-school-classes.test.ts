import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  findClass: vi.fn(),
  findFirstClass: vi.fn(),
  createClass: vi.fn(),
  updateClass: vi.fn(),
  transaction: vi.fn(),
  findAcademicYear: vi.fn(),
  findSundaySchoolYear: vi.fn(),
  ensureWeeklyLessons: vi.fn(),
  canCreateClassAtLevel: vi.fn(),
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
  canCreateClassAtLevel: mocks.canCreateClassAtLevel,
}))
vi.mock('@/lib/sunday-school-lessons', () => ({
  ensureSundaySchoolWeeklyLessons: mocks.ensureWeeklyLessons,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    academicYear: { findFirst: mocks.findAcademicYear },
    sundaySchoolYear: { findFirst: mocks.findSundaySchoolYear },
    sundaySchoolClass: {
      findUnique: mocks.findClass,
      findFirst: mocks.findFirstClass,
    },
    $transaction: mocks.transaction,
  },
}))

import { GET, PATCH } from '@/app/api/sunday-school/classes/[id]/route'
import { POST } from '@/app/api/sunday-school/classes/route'

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
    mocks.canCreateClassAtLevel.mockReturnValue(true)
    mocks.findFirstClass.mockResolvedValue(null)
    mocks.findAcademicYear.mockResolvedValue({ id: 'year-1' })
    mocks.findSundaySchoolYear.mockResolvedValue({ id: 'sunday-year-1' })
    mocks.createClass.mockResolvedValue({
      id: 'class-2',
      name: 'Third Grade Girls',
      level: 'GRADE_3',
      academicYearId: 'year-1',
      sundaySchoolYearId: 'sunday-year-1',
      sectionName: 'Third Grade Girls',
      assignments: [],
      _count: { children: 0, sessions: 0 },
    })
    mocks.updateClass.mockResolvedValue({
      id: 'class-1',
      name: 'Middle School Boys',
      level: 'GRADE_6',
      academicYearId: 'year-1',
      assignments: [],
      _count: { children: 0, sessions: 0 },
    })
    mocks.transaction.mockImplementation(async callback => callback({
      sundaySchoolClass: {
        create: mocks.createClass,
        update: mocks.updateClass,
      },
    }))
    mocks.findClass.mockResolvedValue({
      id: 'class-1',
      name: 'Middle School',
      level: 'GRADE_3',
      academicYearId: 'year-1',
      sundaySchoolYearId: 'sunday-year-1',
      sectionName: 'General',
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

  it('keeps an automatically generated section key aligned after a rename', async () => {
    mocks.findClass.mockResolvedValue({
      id: 'class-1',
      name: 'Third Grade Girls',
      level: 'GRADE_3',
      academicYearId: 'year-1',
      sundaySchoolYearId: 'sunday-year-1',
      sectionName: 'Third Grade Girls',
    })
    mocks.findFirstClass.mockResolvedValue(null)

    const response = await PATCH(
      new Request('http://localhost/api/sunday-school/classes/class-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Third Grade A' }),
      }),
      { params: Promise.resolve({ id: 'class-1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.updateClass).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        name: 'Third Grade A',
        sectionName: 'Third Grade A',
      },
    }))
  })

  it('creates another class in a grade using its name as the section key', async () => {
    mocks.findFirstClass
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'class-1' })
      .mockResolvedValueOnce(null)

    const response = await POST(
      new Request('http://localhost/api/sunday-school/classes', {
        method: 'POST',
        body: JSON.stringify({ name: 'Third Grade Girls', level: 'GRADE_3' }),
      })
    )

    expect(response.status).toBe(201)
    expect(mocks.createClass).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'Third Grade Girls',
        level: 'GRADE_3',
        sectionName: 'Third Grade Girls',
      }),
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
