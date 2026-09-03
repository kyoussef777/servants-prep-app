import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { handleApiError } from '@/lib/api-utils'
import { canReviewServantApplications } from '@/lib/roles'
import { RegistrationStatus } from '@prisma/client'

// GET /api/servant-applications?status=PENDING|APPROVED|REJECTED
// Auth: SUPER_ADMIN only — servant accounts are SUPER_ADMIN-created, so
// there's no SERVANT_PREP view-only tier for this queue.
export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    if (!canReviewServantApplications(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where =
      status && Object.values(RegistrationStatus).includes(status as RegistrationStatus)
        ? { status: status as RegistrationStatus }
        : {}

    const applications = await prisma.servantApplication.findMany({
      where,
      include: {
        reviewer: { select: { id: true, name: true, email: true } },
        createdUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(applications)
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
