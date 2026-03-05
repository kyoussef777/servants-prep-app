import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// PATCH /api/notifications/[id]/read - Mark a single notification as read (used by service worker)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    await prisma.notification.updateMany({
      where: {
        id,
        userId: session.user.id,
      },
      data: { isRead: true },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Mark notification read error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to mark as read' },
      { status: 500 }
    )
  }
}
