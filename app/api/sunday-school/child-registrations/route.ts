import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { handleApiError } from '@/lib/api-utils'
import { getSundaySchoolAccess } from '@/lib/sunday-school-access'
import { RegistrationStatus } from '@prisma/client'

// GET /api/sunday-school/child-registrations?status=PENDING
// Auth: anyone with Sunday School standing. Admins see every request;
// coordinators see only requests at levels their band covers.
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? RegistrationStatus.PENDING

    const access = await getSundaySchoolAccess(user)
    if (!access.canRead) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const where: Record<string, unknown> = {}
    if (Object.values(RegistrationStatus).includes(status as RegistrationStatus)) {
      where.status = status
    }
    if (!access.isAdmin) {
      where.intendedLevel = { in: Array.from(access.coordinatorLevels) }
    }

    const requests = await prisma.childRegistrationRequest.findMany({
      where,
      include: {
        submittedBy: { select: { id: true, name: true, email: true, phone: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        placedClass: { select: { id: true, name: true, level: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(requests)
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
