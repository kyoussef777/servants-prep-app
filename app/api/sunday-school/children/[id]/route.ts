import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canAccessSundaySchool, canManageSundaySchoolChildren } from "@/lib/roles"
import { getServantClassIds, handleApiError } from "@/lib/api-utils"
import { isValidLevel } from "@/lib/sunday-school-class"

// Sunday School mode: a single child on a Sunday School roster.

/**
 * A servant may only touch children in the classes they serve. Returns the
 * child's current classId, or throws Forbidden / Not found.
 */
async function loadChildForUser(
  childId: string,
  userId: string,
  role: Parameters<typeof getServantClassIds>[1]
) {
  const child = await prisma.sundaySchoolChild.findUnique({
    where: { id: childId },
    select: { id: true, classId: true },
  })
  if (!child) {
    throw new Error("Not found")
  }

  const servantClassIds = await getServantClassIds(userId, role)
  if (servantClassIds && (!child.classId || !servantClassIds.includes(child.classId))) {
    throw new Error("Forbidden")
  }

  return child
}

// GET /api/sunday-school/children/[id] - Child detail with attendance history
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

    await loadChildForUser(id, user.id, user.role)

    const child = await prisma.sundaySchoolChild.findUnique({
      where: { id },
      include: {
        class: { select: { id: true, name: true, level: true } },
        attendance: {
          include: {
            session: { select: { id: true, date: true, topic: true } },
          },
          orderBy: { session: { date: "desc" } },
        },
      },
    })

    return NextResponse.json(child)
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// PATCH /api/sunday-school/children/[id] - Update a child
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    if (!canManageSundaySchoolChildren(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await loadChildForUser(id, user.id, user.role)

    const body = await request.json()
    const {
      firstName,
      lastName,
      level,
      classId,
      birthDate,
      guardianName,
      guardianPhone,
      guardianEmail,
      notes,
      isActive,
    } = body

    const updateData: Record<string, unknown> = {}

    if (firstName !== undefined) {
      if (!String(firstName).trim()) {
        return NextResponse.json({ error: "First name cannot be empty" }, { status: 400 })
      }
      updateData.firstName = String(firstName).trim()
    }
    if (lastName !== undefined) {
      if (!String(lastName).trim()) {
        return NextResponse.json({ error: "Last name cannot be empty" }, { status: 400 })
      }
      updateData.lastName = String(lastName).trim()
    }
    if (level !== undefined) {
      if (!isValidLevel(level)) {
        return NextResponse.json({ error: "Invalid grade level" }, { status: 400 })
      }
      updateData.level = level
    }
    if (classId !== undefined) {
      // A servant cannot move a child out of (or into) a class they don't serve
      const servantClassIds = await getServantClassIds(user.id, user.role)
      if (servantClassIds && (!classId || !servantClassIds.includes(classId))) {
        return NextResponse.json(
          { error: "You can only move a child between classes you serve" },
          { status: 403 }
        )
      }
      updateData.classId = classId || null
    }
    if (birthDate !== undefined) {
      if (birthDate) {
        const parsed = new Date(birthDate)
        if (isNaN(parsed.getTime())) {
          return NextResponse.json({ error: "Invalid birth date" }, { status: 400 })
        }
        updateData.birthDate = parsed
      } else {
        updateData.birthDate = null
      }
    }
    if (guardianName !== undefined) updateData.guardianName = guardianName?.trim() || null
    if (guardianPhone !== undefined) updateData.guardianPhone = guardianPhone?.trim() || null
    if (guardianEmail !== undefined) updateData.guardianEmail = guardianEmail?.trim() || null
    if (notes !== undefined) updateData.notes = notes?.trim() || null
    if (isActive !== undefined) updateData.isActive = Boolean(isActive)

    const updated = await prisma.sundaySchoolChild.update({
      where: { id },
      data: updateData,
      include: {
        class: { select: { id: true, name: true, level: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// DELETE /api/sunday-school/children/[id] - Remove a child from the roster
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    if (!canManageSundaySchoolChildren(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await loadChildForUser(id, user.id, user.role)

    await prisma.sundaySchoolChild.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
