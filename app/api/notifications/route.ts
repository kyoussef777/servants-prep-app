import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'

// GET /api/notifications - Get notifications for the current user
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)
    const cursor = url.searchParams.get('cursor') || undefined
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true'

    const where: { userId: string; isRead?: boolean } = { userId: user.id }
    if (unreadOnly) {
      where.isRead = false
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = notifications.length > limit
    if (hasMore) notifications.pop()

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, isRead: false },
    })

    return NextResponse.json({
      notifications,
      unreadCount,
      nextCursor: hasMore ? notifications[notifications.length - 1]?.id : null,
    })
  } catch (error: unknown) {
    console.error('Get notifications error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch notifications' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}
