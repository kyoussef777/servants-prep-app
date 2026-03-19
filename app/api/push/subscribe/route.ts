import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'

// POST /api/push/subscribe - Subscribe to push notifications
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { endpoint, keys } = body

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: 'Invalid push subscription data' },
        { status: 400 }
      )
    }

    // Upsert subscription (update if endpoint already exists for this user)
    const subscription = await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: user.id,
          endpoint,
        },
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: request.headers.get('user-agent') || null,
      },
      create: {
        userId: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: request.headers.get('user-agent') || null,
      },
    })

    return NextResponse.json({ id: subscription.id, success: true })
  } catch (error: unknown) {
    console.error('Push subscribe error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to subscribe' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}
