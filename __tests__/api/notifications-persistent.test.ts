import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  deleteMany: vi.fn(),
  updateMany: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  ensureAnnualMentorReminder: vi.fn(),
  ensurePendingServantApplicationNotifications: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/lib/annual-mentor-information', () => ({
  ensureAnnualMentorReminder: mocks.ensureAnnualMentorReminder,
}))
vi.mock('@/lib/notifications', () => ({
  ensurePendingServantApplicationNotifications: mocks.ensurePendingServantApplicationNotifications,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      deleteMany: mocks.deleteMany,
      updateMany: mocks.updateMany,
      findMany: mocks.findMany,
      count: mocks.count,
    },
  },
}))

import { DELETE, GET } from '@/app/api/notifications/route'
import { PATCH } from '@/app/api/notifications/read/route'

const missingPersistenceColumn = {
  code: 'P2022',
  meta: { column: 'Notification.isPersistent' },
}

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
    mocks.findMany.mockResolvedValue([])
    mocks.count.mockResolvedValue(0)
    mocks.ensureAnnualMentorReminder.mockResolvedValue(undefined)
    mocks.ensurePendingServantApplicationNotifications.mockResolvedValue(undefined)
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

  it('returns legacy notifications while the persistence migration is pending', async () => {
    mocks.findMany
      .mockRejectedValueOnce(missingPersistenceColumn)
      .mockResolvedValueOnce([{
        id: 'legacy-1',
        userId: 'student-1',
        type: 'ANNOUNCEMENT',
        title: 'Existing notification',
        body: 'Still available during migration rollout',
        url: null,
        isRead: false,
        metadata: null,
        createdAt: new Date('2026-09-26T12:00:00Z'),
      }])

    const response = await GET(new NextRequest('http://localhost/api/notifications'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.notifications).toEqual([
      expect.objectContaining({ id: 'legacy-1', isPersistent: false }),
    ])
    expect(mocks.findMany).toHaveBeenCalledTimes(2)
    expect(mocks.findMany.mock.calls[1][0]).toEqual(expect.objectContaining({
      select: expect.not.objectContaining({ isPersistent: expect.anything() }),
    }))
  })

  it('falls back to clearing legacy notifications before the migration', async () => {
    mocks.deleteMany
      .mockRejectedValueOnce(missingPersistenceColumn)
      .mockResolvedValueOnce({ count: 1 })

    const response = await DELETE(request(
      'http://localhost/api/notifications',
      'DELETE',
      { clearAll: true }
    ))

    expect(response.status).toBe(200)
    expect(mocks.deleteMany).toHaveBeenLastCalledWith({
      where: { userId: 'student-1' },
    })
  })

  it('falls back to marking legacy notifications read before the migration', async () => {
    mocks.updateMany
      .mockRejectedValueOnce(missingPersistenceColumn)
      .mockResolvedValueOnce({ count: 1 })

    const response = await PATCH(request(
      'http://localhost/api/notifications/read',
      'PATCH',
      { markAllRead: true }
    ))

    expect(response.status).toBe(200)
    expect(mocks.updateMany).toHaveBeenLastCalledWith({
      where: { userId: 'student-1', isRead: false },
      data: { isRead: true },
    })
  })
})
