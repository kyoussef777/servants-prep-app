import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-helpers'
import { handleApiError } from '@/lib/api-utils'
import { UserRole } from '@prisma/client'

// GET /api/parent/children
// Auth: PARENT only. Returns the parent's linked children (via
// SundaySchoolChildGuardian) plus their own pending/reviewed registration
// requests.
export async function GET() {
  try {
    const user = await requireRole([UserRole.PARENT])

    const [guardianLinks, requests] = await Promise.all([
      prisma.sundaySchoolChildGuardian.findMany({
        where: { parentId: user.id, endedAt: null },
        select: {
          relationshipLabel: true,
          linkedAt: true,
          child: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              birthDate: true,
              status: true,
              isActive: true,
              class: { select: { id: true, name: true, level: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.childRegistrationRequest.findMany({
        where: { submittedByUserId: user.id },
        select: {
          id: true,
          status: true,
          firstName: true,
          lastName: true,
          birthDate: true,
          intendedLevel: true,
          placedClass: { select: { id: true, name: true, level: true } },
          createdAt: true,
          reviewedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return NextResponse.json({
      children: guardianLinks.map((link) => ({
        ...link.child,
        relationshipLabel: link.relationshipLabel,
        linkedAt: link.linkedAt,
      })),
      pendingRequests: requests,
    })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
