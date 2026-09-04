import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { handleApiError } from "@/lib/api-utils"
import {
  canCoordinateClass,
  canDeleteClass,
  canServeClass,
  canTakeServantAttendance,
  canViewClass,
  getSundaySchoolAccess,
} from "@/lib/sunday-school-access"
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

    const sundaySchoolClass = await prisma.sundaySchoolClass.findUnique({
      where: { id },
      include: {
        academicYear: { select: { id: true, name: true } },
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true, profileImageUrl: true },
            },
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

    const access = await getSundaySchoolAccess(user, sundaySchoolClass.academicYearId)
    if (!canViewClass(access, id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({
      ...sundaySchoolClass,
      canCoordinate: canCoordinateClass(access, id),
      canServe: canServeClass(access, id),
      canTakeServantAttendance: canTakeServantAttendance(access, id),
      canDelete: canDeleteClass(access, sundaySchoolClass.level),
    })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// PATCH /api/sunday-school/classes/[id] - Update a class
// The class's coordinator, its band coordinator, or SUPER_ADMIN.
// Body: { name?, level?, isActive? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const existing = await prisma.sundaySchoolClass.findUnique({
      where: { id },
      select: { id: true, academicYearId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 })
    }

    const access = await getSundaySchoolAccess(user, existing.academicYearId)
    if (!canCoordinateClass(access, id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { name, level, isActive } = body

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
      // Moving a class to another level can move it to another band, which
      // would hand it to a different coordinator — so that needs band
      // authority over the destination, not just over the class.
      if (!access.isAdmin && !access.coordinatorLevels.has(level)) {
        return NextResponse.json(
          { error: "You cannot move a class into a grade level outside your age group" },
          { status: 403 }
        )
      }
      updateData.level = level
    }
    if (isActive !== undefined) updateData.isActive = Boolean(isActive)

    const updated = await prisma.sundaySchoolClass.update({
      where: { id },
      data: updateData,
      include: {
        academicYear: { select: { id: true, name: true } },
        assignments: {
          include: { user: { select: { id: true, name: true, email: true, profileImageUrl: true } } },
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
// SUPER_ADMIN or the coordinator of the class's age group. Coordinating the
// class itself is not enough. Sessions and assignments cascade; children are
// unassigned (SetNull) rather than deleted so a roster is never lost.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const existing = await prisma.sundaySchoolClass.findUnique({
      where: { id },
      select: { id: true, level: true, academicYearId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 })
    }

    const access = await getSundaySchoolAccess(user, existing.academicYearId)
    if (!canDeleteClass(access, existing.level)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.sundaySchoolClass.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
