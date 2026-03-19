import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'

// PATCH /api/notifications/read - Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { notificationIds, markAllRead } = body

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true },
      })
    } else if (notificationIds && Array.isArray(notificationIds)) {
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: user.id,
        },
        data: { isRead: true },
      })
    } else {
      return NextResponse.json(
        { error: 'Provide notificationIds or markAllRead' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Mark notifications read error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to mark as read' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}
