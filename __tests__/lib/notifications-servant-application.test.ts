import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationType, RoleTag } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  findAdmins: vi.fn(),
  findAdmin: vi.fn(),
  findPendingApplications: vi.fn(),
  claimApplication: vi.fn(),
  createNotification: vi.fn(),
  transaction: vi.fn(),
  findSubscriptions: vi.fn(),
}))

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
    WebPushError: class WebPushError extends Error {
      statusCode = 500
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: mocks.findAdmins,
      findFirst: mocks.findAdmin,
    },
    servantApplication: { findMany: mocks.findPendingApplications },
    pushSubscription: { findMany: mocks.findSubscriptions },
    $transaction: mocks.transaction,
  },
}))

import {
  ensurePendingServantApplicationNotifications,
  notifyNewServantApplication,
} from '@/lib/notifications'

const transactionClient = {
  servantApplication: { updateMany: mocks.claimApplication },
  notification: { create: mocks.createNotification },
}

describe('servant application in-app notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findAdmins.mockResolvedValue([{ id: 'admin-1' }])
    mocks.findAdmin.mockResolvedValue({ id: 'admin-1' })
    mocks.findPendingApplications.mockResolvedValue([])
    mocks.claimApplication.mockResolvedValue({ count: 1 })
    mocks.createNotification.mockImplementation(async ({ data }) => ({
      id: `notification-${data.userId}`,
      ...data,
    }))
    mocks.findSubscriptions.mockResolvedValue([])
    mocks.transaction.mockImplementation(async callback => callback(transactionClient))
  })

  it('commits the in-app notification and delivery marker before returning', async () => {
    await notifyNewServantApplication({
      applicantName: 'New Servant',
      applicationId: 'application-1',
    })

    expect(mocks.findAdmins).toHaveBeenCalledWith({
      where: {
        isDisabled: false,
        OR: [
          { role: 'SUPER_ADMIN' },
          {
            roleAssignments: {
              some: { tag: RoleTag.SUPER_ADMIN, revokedAt: null },
            },
          },
        ],
      },
      select: { id: true },
    })
    expect(mocks.claimApplication).toHaveBeenCalledWith({
      where: { id: 'application-1', adminNotifiedAt: null },
      data: { adminNotifiedAt: expect.any(Date) },
    })
    expect(mocks.createNotification).toHaveBeenCalledWith({
      data: {
        userId: 'admin-1',
        type: NotificationType.SERVANT_APPLICATION_RECEIVED,
        title: 'New Servant Application',
        body: 'New Servant has applied to serve in Sunday School.',
        url: '/dashboard/servants/servant-applications',
        metadata: {
          applicationId: 'application-1',
          applicantName: 'New Servant',
        },
      },
    })
  })

  it('repairs previously missed pending application notifications', async () => {
    mocks.findPendingApplications.mockResolvedValue([
      { id: 'application-1', fullName: 'First Servant' },
      { id: 'application-2', fullName: 'Second Servant' },
    ])

    await ensurePendingServantApplicationNotifications('admin-1')

    expect(mocks.findPendingApplications).toHaveBeenCalledWith({
      where: { status: 'PENDING', adminNotifiedAt: null },
      select: { id: true, fullName: true },
      orderBy: { createdAt: 'asc' },
    })
    expect(mocks.claimApplication).toHaveBeenCalledTimes(2)
    expect(mocks.createNotification).toHaveBeenCalledTimes(2)
  })

  it('does not create duplicates when another request already claimed delivery', async () => {
    mocks.claimApplication.mockResolvedValue({ count: 0 })

    await notifyNewServantApplication({
      applicantName: 'New Servant',
      applicationId: 'application-1',
    })

    expect(mocks.createNotification).not.toHaveBeenCalled()
  })
})
