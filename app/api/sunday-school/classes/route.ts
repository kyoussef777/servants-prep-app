import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { handleApiError } from "@/lib/api-utils"
import {
  canCreateClassAtLevel,
  canTakeServantAttendance,
  getSundaySchoolAccess,
  visibleClassFilter,
} from "@/lib/sunday-school-access"
import { isValidLevel } from "@/lib/sunday-school-class"
import { SundaySchoolLevel } from "@prisma/client"

// Sunday School mode: the Sunday School classes themselves.
// Not related to /api/sunday-school/assignments, which tracks async Servants
// Prep students serving their required weeks.

const classInclude = {
  academicYear: { select: { id: true, name: true } },
  assignments: {
    include: {
      user: { select: { id: true, name: true, email: true, profileImageUrl: true } },
    },
  },
  _count: { select: { children: true, sessions: true } },
} as const

// GET /api/sunday-school/classes - List classes
// Query params: ?academicYearId=xxx  ?level=GRADE_3  ?isActive=true
// Scoped to what the caller's assignments cover; admins and priests see all.
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const academicYearId = searchParams.get("academicYearId")
    const level = searchParams.get("level")
    const isActive = searchParams.get("isActive")

    const access = await getSundaySchoolAccess(user, academicYearId ?? undefined)
    if (!access.canRead) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const where: Record<string, unknown> = {}
    if (academicYearId) where.academicYearId = academicYearId
    if (level) where.level = level as SundaySchoolLevel
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === "true"

    const allowedClassIds = visibleClassFilter(access)
    if (allowedClassIds) {
      where.id = { in: allowedClassIds }
    }

    const classes = await prisma.sundaySchoolClass.findMany({
      where,
      include: classInclude,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    })

    // Tell the client what it may offer for each class, so the UI does not
    // have to re-derive authority (the server still re-checks every write).
    return NextResponse.json(
      classes.map(cls => ({
        ...cls,
        canCoordinate: access.isAdmin || access.coordinatorClassIds.has(cls.id),
        canTakeServantAttendance: canTakeServantAttendance(access, cls.id),
        canServe:
          access.isAdmin ||
          (!access.readOnly &&
            (access.servantClassIds.has(cls.id) || access.coordinatorClassIds.has(cls.id))),
      }))
    )
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// POST /api/sunday-school/classes - Create a class
// SUPER_ADMIN anywhere; an age-group coordinator within their own band.
// Body: { name, level, academicYearId? }
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { name, level } = body
    let { academicYearId } = body

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Class name is required" }, { status: 400 })
    }
    if (!isValidLevel(level)) {
      return NextResponse.json({ error: "A valid grade level is required" }, { status: 400 })
    }

    if (!academicYearId) {
      const activeYear = await prisma.academicYear.findFirst({
        where: { isActive: true },
        select: { id: true },
      })
      if (!activeYear) {
        return NextResponse.json(
          { error: "No active academic year. Create one before adding classes." },
          { status: 400 }
        )
      }
      academicYearId = activeYear.id
    }

    const access = await getSundaySchoolAccess(user, academicYearId)
    if (!canCreateClassAtLevel(access, level)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const trimmedName = String(name).trim()

    const existing = await prisma.sundaySchoolClass.findFirst({
      where: { name: trimmedName, academicYearId },
    })
    if (existing) {
      return NextResponse.json(
        { error: "A class with this name already exists for that academic year" },
        { status: 409 }
      )
    }

    const created = await prisma.sundaySchoolClass.create({
      data: { name: trimmedName, level, academicYearId },
      include: classInclude,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
