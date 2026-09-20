import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getSundaySchoolAccess: vi.fn(),
  visibleClassFilter: vi.fn(),
  familyFindMany: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/lib/sunday-school-access', () => ({
  getSundaySchoolAccess: mocks.getSundaySchoolAccess,
  visibleClassFilter: mocks.visibleClassFilter,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    sundaySchoolFamily: { findMany: mocks.familyFindMany },
  },
}))

import { GET } from '@/app/api/sunday-school/families/route'

describe('Sunday School families API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'servant-1', role: 'SERVANT' })
    mocks.getSundaySchoolAccess.mockResolvedValue({ canRead: true })
    mocks.visibleClassFilter.mockReturnValue(['class-1'])
    mocks.familyFindMany.mockResolvedValue([])
  })

  it('refuses users without Sunday School visibility', async () => {
    mocks.getSundaySchoolAccess.mockResolvedValue({ canRead: false })

    const response = await GET()

    expect(response.status).toBe(403)
    expect(mocks.familyFindMany).not.toHaveBeenCalled()
  })

  it('only lists families connected to a scoped viewer\'s visible classes', async () => {
    await GET()

    expect(mocks.familyFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        children: {
          some: { classId: { in: ['class-1'] } },
        },
      },
    }))
  })

  it('lets an all-class viewer load every non-empty family', async () => {
    mocks.visibleClassFilter.mockReturnValue(undefined)

    await GET()

    expect(mocks.familyFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { children: { some: {} } },
    }))
  })
})
