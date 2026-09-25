import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  deleteMany: vi.fn(),
  updateMany: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      deleteMany: mocks.deleteMany,
      updateMany: mocks.updateMany,
    },
  },
}))

import { DELETE } from '@/app/api/notifications/route'
import { PATCH } from '@/app/api/notifications/read/route'

function request(url: string, method: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('persistent notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'student-1', role: 'STUDENT' })
    mocks.deleteMany.mockResolvedValue({ count: 0 })
    mocks.updateMany.mockResolvedValue({ count: 0 })
  })

  it('excludes persistent reminders when clearing notifications', async () => {
    const response = await DELETE(request(
      'http://localhost/api/notifications',
      'DELETE',
      { clearAll: true }
    ))

    expect(response.status).toBe(200)
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'student-1', isPersistent: false },
    })
  })

  it('does not mark persistent reminders as read', async () => {
    const response = await PATCH(request(
      'http://localhost/api/notifications/read',
      'PATCH',
      { notificationIds: ['required-1'] }
    ))

    expect(response.status).toBe(200)
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['required-1'] },
        userId: 'student-1',
        isPersistent: false,
      },
      data: { isRead: true },
    })
  })
})
