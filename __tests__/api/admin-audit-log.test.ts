import { RoleTag } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAuthorizationContext: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/lib/authorization', () => ({ getAuthorizationContext: mocks.getAuthorizationContext }))
vi.mock('@/lib/prisma', () => ({
  prisma: { auditEvent: { findMany: mocks.findMany, count: mocks.count } },
}))

import { GET } from '@/app/api/admin/audit-log/route'

describe('admin audit log API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'admin-1' })
    mocks.getAuthorizationContext.mockResolvedValue({
      disabled: false,
      roleTags: new Set([RoleTag.SUPER_ADMIN]),
    })
    mocks.findMany.mockResolvedValue([])
    mocks.count.mockResolvedValue(0)
  })

  it('requires a current Super Admin grant', async () => {
    mocks.getAuthorizationContext.mockResolvedValue({ disabled: false, roleTags: new Set() })

    const response = await GET(new Request('http://localhost/api/admin/audit-log'))

    expect(response.status).toBe(403)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('returns paginated activity and applies search and result filters', async () => {
    const response = await GET(new Request(
      'http://localhost/api/admin/audit-log?page=2&pageSize=20&search=liza&result=DENIED'
    ))

    expect(response.status).toBe(200)
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 20,
      take: 20,
      orderBy: { createdAt: 'desc' },
      where: expect.objectContaining({ result: 'DENIED', OR: expect.any(Array) }),
    }))
  })
})
