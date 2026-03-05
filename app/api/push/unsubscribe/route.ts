import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'

// POST /api/push/unsubscribe - Remove a push subscription
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { endpoint } = body

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Missing endpoint' },
        { status: 400 }
      )
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        userId: user.id,
        endpoint,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Push unsubscribe error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to unsubscribe' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}
