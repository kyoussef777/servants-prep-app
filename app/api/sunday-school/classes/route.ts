import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canAccessSundaySchool, canManageSundaySchoolClasses } from "@/lib/roles"
import { getServantClassIds, handleApiError } from "@/lib/api-utils"
import { isValidLevel } from "@/lib/sunday-school-class"
import { SundaySchoolLevel } from "@prisma/client"

// Sunday School mode: the Sunday School classes themselves.
// Not related to /api/sunday-school/assignments, which tracks async Servants
// Prep students serving their required weeks.

// GET /api/sunday-school/classes - List classes
// Query params: ?academicYearId=xxx  ?level=GRADE_3  ?isActive=true
// A SERVANT only ever sees the classes they are assigned to.
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    if (!canAccessSundaySchool(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const academicYearId = searchParams.get("academicYearId")
    const level = searchParams.get("level")
    const isActive = searchParams.get("isActive")

    const where: Record<string, unknown> = {}
    if (academicYearId) where.academicYearId = academicYearId
    if (level) where.level = level as SundaySchoolLevel
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === "true"

    const servantClassIds = await getServantClassIds(user.id, user.role)
    if (servantClassIds) {
      where.id = { in: servantClassIds }
    }

    const classes = await prisma.sundaySchoolClass.findMany({
      where,
      include: {
        academicYear: { select: { id: true, name: true } },
        servants: {
          include: {
            servant: { select: { id: true, name: true, email: true, profileImageUrl: true } },
          },
        },
        _count: { select: { children: true, sessions: true } },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    })

    return NextResponse.json(classes)
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// POST /api/sunday-school/classes - Create a class
// Body: { name, level, academicYearId? }
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    if (!canManageSundaySchoolClasses(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { name, level, academicYearId } = body

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Class name is required" }, { status: 400 })
    }
    if (!isValidLevel(level)) {
      return NextResponse.json({ error: "A valid grade level is required" }, { status: 400 })
    }

    const trimmedName = String(name).trim()

    const existing = await prisma.sundaySchoolClass.findFirst({
      where: { name: trimmedName, academicYearId: academicYearId || null },
    })
    if (existing) {
      return NextResponse.json(
        { error: "A class with this name already exists for that academic year" },
        { status: 409 }
      )
    }

    const created = await prisma.sundaySchoolClass.create({
      data: {
        name: trimmedName,
        level,
        academicYearId: academicYearId || null,
      },
      include: {
        academicYear: { select: { id: true, name: true } },
        servants: {
          include: { servant: { select: { id: true, name: true, email: true, profileImageUrl: true } } },
        },
        _count: { select: { children: true, sessions: true } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
