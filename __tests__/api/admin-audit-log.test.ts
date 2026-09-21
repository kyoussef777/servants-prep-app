import { RoleTag } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAuthorizationContext: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  findUsers: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/lib/authorization', () => ({ getAuthorizationContext: mocks.getAuthorizationContext }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditEvent: { findMany: mocks.findMany, count: mocks.count },
    user: { findMany: mocks.findUsers },
  },
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
    mocks.findUsers.mockResolvedValue([])
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
    expect(mocks.findUsers).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: expect.any(Array) },
      select: { id: true },
    }))
  })

  it('adds a readable target for user activity', async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: 'event-1',
        actorUserId: 'admin-1',
        action: 'ADMIN_VIEW_AS_STARTED',
        entityType: 'User',
        entityId: 'user-2',
        result: 'SUCCESS',
        reason: null,
        metadata: { readOnly: true },
        createdAt: new Date('2026-09-21T12:00:00Z'),
        actor: { id: 'admin-1', name: 'Admin', email: 'admin@example.com' },
      },
    ])
    mocks.count.mockResolvedValue(1)
    mocks.findUsers.mockResolvedValue([
      { id: 'user-2', name: 'Liza Hanna', email: 'liza@example.com' },
    ])

    const response = await GET(new Request('http://localhost/api/admin/audit-log'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.events[0].target).toEqual({
      id: 'user-2',
      name: 'Liza Hanna',
      email: 'liza@example.com',
    })
    expect(body.retention).toEqual(expect.objectContaining({
      days: expect.any(Number),
      maxEvents: expect.any(Number),
    }))
  })
})
