import type { Prisma } from '@prisma/client'

export const notificationSelectWithoutPersistence = {
  id: true,
  userId: true,
  type: true,
  title: true,
  body: true,
  url: true,
  isRead: true,
  metadata: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect

export function isMissingNotificationPersistenceColumn(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const candidate = error as {
    code?: unknown
    meta?: { column?: unknown }
    message?: unknown
  }
  const column = String(candidate.meta?.column ?? '')
  const message = String(candidate.message ?? '')

  return candidate.code === 'P2022' &&
    (column.includes('Notification.isPersistent') ||
      message.includes('Notification.isPersistent'))
}
