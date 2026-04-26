import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Health check endpoint to verify database connectivity.
 * GET /api/health
 *
 * Public endpoint — must not leak environment configuration, deployment URLs,
 * or user counts. Returns ok/error only.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
