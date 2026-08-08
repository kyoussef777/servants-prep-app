import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canAccessSundaySchool, canManageSundaySchoolClasses } from "@/lib/roles"
import { getServantClassIds, handleApiError } from "@/lib/api-utils"
import { isValidLevel } from "@/lib/sunday-school-class"

// Sunday School mode: a single Sunday School class.

// GET /api/sunday-school/classes/[id] - Class detail with roster, servants, sessions
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    if (!canAccessSundaySchool(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const servantClassIds = await getServantClassIds(user.id, user.role)
    if (servantClassIds && !servantClassIds.includes(id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const sundaySchoolClass = await prisma.sundaySchoolClass.findUnique({
      where: { id },
      include: {
        academicYear: { select: { id: true, name: true } },
        servants: {
          include: {
            servant: { select: { id: true, name: true, email: true, phone: true, profileImageUrl: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        children: {
          orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
        },
        sessions: {
          orderBy: { date: "desc" },
          include: {
            taker: { select: { id: true, name: true } },
            _count: { select: { attendance: true } },
          },
        },
      },
    })

    if (!sundaySchoolClass) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 })
    }

    return NextResponse.json(sundaySchoolClass)
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// PATCH /api/sunday-school/classes/[id] - Update a class
// Body: { name?, level?, academicYearId?, isActive? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    if (!canManageSundaySchoolClasses(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { name, level, academicYearId, isActive } = body

    const updateData: Record<string, unknown> = {}

    if (name !== undefined) {
      if (!String(name).trim()) {
        return NextResponse.json({ error: "Class name cannot be empty" }, { status: 400 })
      }
      updateData.name = String(name).trim()
    }
    if (level !== undefined) {
      if (!isValidLevel(level)) {
        return NextResponse.json({ error: "Invalid grade level" }, { status: 400 })
      }
      updateData.level = level
    }
    if (academicYearId !== undefined) updateData.academicYearId = academicYearId || null
    if (isActive !== undefined) updateData.isActive = Boolean(isActive)

    const updated = await prisma.sundaySchoolClass.update({
      where: { id },
      data: updateData,
      include: {
        academicYear: { select: { id: true, name: true } },
        servants: {
          include: { servant: { select: { id: true, name: true, email: true, profileImageUrl: true } } },
        },
        _count: { select: { children: true, sessions: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// DELETE /api/sunday-school/classes/[id] - Delete a class
// Sessions and servant assignments cascade; children are unassigned (SetNull)
// rather than deleted so a roster is never lost by removing a class.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    if (!canManageSundaySchoolClasses(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.sundaySchoolClass.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
