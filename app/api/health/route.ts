import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Health check endpoint to verify database connectivity
 * GET /api/health
 */
export async function GET() {
  try {
    // Try to connect to database and count users
    const userCount = await prisma.user.count()

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      userCount,
      timestamp: new Date().toISOString(),
      env: {
        hasDbUrl: !!process.env.SP_DATABASE_URL,
        hasDbUrlUnpooled: !!process.env.SP_DATABASE_URL_UNPOOLED,
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        nextAuthUrl: process.env.NEXTAUTH_URL,
        nodeEnv: process.env.NODE_ENV
      }
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        env: {
          hasDbUrl: !!process.env.SP_DATABASE_URL,
          hasDbUrlUnpooled: !!process.env.SP_DATABASE_URL_UNPOOLED,
          hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
          nextAuthUrl: process.env.NEXTAUTH_URL,
          nodeEnv: process.env.NODE_ENV
        }
      },
      { status: 500 }
    )
  }
}
