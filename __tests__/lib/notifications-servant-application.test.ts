import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationType, RoleTag } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  findAdmins: vi.fn(),
  findAdmin: vi.fn(),
  findPendingApplications: vi.fn(),
  findExistingNotifications: vi.fn(),
  updateExistingNotifications: vi.fn(),
  upsertNotification: vi.fn(),
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
    notification: { findMany: mocks.findExistingNotifications },
    pushSubscription: { findMany: mocks.findSubscriptions },
    $transaction: mocks.transaction,
  },
}))

import {
  ensurePendingServantApplicationNotifications,
  notifyNewServantApplication,
} from '@/lib/notifications'

const transactionClient = {
  notification: {
    updateMany: mocks.updateExistingNotifications,
    upsert: mocks.upsertNotification,
  },
}

describe('servant application in-app notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findAdmins.mockResolvedValue([{ id: 'admin-1' }])
    mocks.findAdmin.mockResolvedValue({ id: 'admin-1' })
    mocks.findPendingApplications.mockResolvedValue([])
    mocks.findExistingNotifications.mockResolvedValue([])
    mocks.updateExistingNotifications.mockResolvedValue({ count: 0 })
    mocks.upsertNotification.mockImplementation(async ({ create }) => ({
      ...create,
    }))
    mocks.findSubscriptions.mockResolvedValue([])
    mocks.transaction.mockImplementation(async callback => callback(transactionClient))
  })

  it('commits a persistent in-app notification before returning', async () => {
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
    expect(mocks.findExistingNotifications).toHaveBeenCalledWith({
      where: {
        userId: { in: ['admin-1'] },
        type: NotificationType.SERVANT_APPLICATION_RECEIVED,
      },
      select: { id: true, userId: true, metadata: true, isPersistent: true },
    })
    expect(mocks.upsertNotification).toHaveBeenCalledWith({
      where: { id: 'servant-application:application-1:admin-1' },
      create: {
        id: 'servant-application:application-1:admin-1',
        userId: 'admin-1',
        type: NotificationType.SERVANT_APPLICATION_RECEIVED,
        title: 'New Servant Application',
        body: 'New Servant has applied to serve in Sunday School.',
        url: '/dashboard/servants/servant-applications',
        metadata: {
          applicationId: 'application-1',
          applicantName: 'New Servant',
        },
        isPersistent: true,
      },
      update: { isPersistent: true },
    })
  })

  it('repairs previously missed pending application notifications', async () => {
    mocks.findPendingApplications.mockResolvedValue([
      { id: 'application-1', fullName: 'First Servant' },
      { id: 'application-2', fullName: 'Second Servant' },
    ])

    await ensurePendingServantApplicationNotifications('admin-1')

    expect(mocks.findPendingApplications).toHaveBeenCalledWith({
      where: { status: 'PENDING' },
      select: { id: true, fullName: true },
      orderBy: { createdAt: 'asc' },
    })
    expect(mocks.upsertNotification).toHaveBeenCalledTimes(2)
  })

  it('upgrades an existing alert without creating a duplicate', async () => {
    mocks.findExistingNotifications.mockResolvedValue([{
      id: 'existing-notification',
      userId: 'admin-1',
      metadata: { applicationId: 'application-1' },
      isPersistent: false,
    }])

    await notifyNewServantApplication({
      applicantName: 'New Servant',
      applicationId: 'application-1',
    })

    expect(mocks.updateExistingNotifications).toHaveBeenCalledWith({
      where: { id: { in: ['existing-notification'] } },
      data: { isPersistent: true },
    })
    expect(mocks.upsertNotification).not.toHaveBeenCalled()
  })
})
