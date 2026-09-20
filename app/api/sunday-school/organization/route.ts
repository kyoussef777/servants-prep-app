import { NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { requireAuth } from '@/lib/auth-helpers'
import { handleApiError } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { getSundaySchoolAccess } from '@/lib/sunday-school-access'

const personSelect = { id: true, name: true, profileImageUrl: true } as const

// The Users page is admin-only. Do not expose the full directory to scoped servants.
export async function GET() {
  try {
    const user = await requireAuth()
    const access = await getSundaySchoolAccess(user)
    if (!access.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const academicYear = await prisma.academicYear.findFirst({
      where: { isActive: true }, select: { id: true, name: true },
    })
    if (!academicYear) {
      return NextResponse.json({ academicYear: null, priests: [], classes: [], ageGroups: [], assignments: [] })
    }

    const [priests, classes, ageGroups, assignments] = await Promise.all([
      prisma.user.findMany({
        where: { role: UserRole.PRIEST, isDisabled: false },
        select: personSelect, orderBy: { name: 'asc' },
      }),
      prisma.sundaySchoolClass.findMany({
        where: { academicYearId: academicYear.id, isActive: true },
        select: { id: true, name: true, level: true }, orderBy: { name: 'asc' },
      }),
      prisma.sundaySchoolAgeGroup.findMany({
        where: { isActive: true },
        select: { id: true, name: true, levels: true, overseerId: true }, orderBy: { sortOrder: 'asc' },
      }),
      prisma.sundaySchoolServantAssignment.findMany({
        where: { academicYearId: academicYear.id, user: { isDisabled: false } },
        select: {
          authority: true, classId: true, ageGroupId: true,
          user: { select: personSelect },
        },
      }),
    ])

    return NextResponse.json({ academicYear, priests, classes, ageGroups, assignments })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
