import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { handleApiError } from "@/lib/api-utils"
import {
  canServeClass,
  canViewClass,
  getSundaySchoolAccess,
  type SundaySchoolAccess,
} from "@/lib/sunday-school-access"
import { isValidLevel } from "@/lib/sunday-school-class"

// Sunday School mode: a single child on a Sunday School roster.

/**
 * You may only touch children in classes your assignments cover. Returns the
 * child's current classId, or throws Forbidden / Not found.
 *
 * `write` distinguishes reading a child's record from changing it, so PRIEST
 * can look without being able to edit.
 */
async function loadChildForUser(
  childId: string,
  access: SundaySchoolAccess,
  write: boolean
) {
  const child = await prisma.sundaySchoolChild.findUnique({
    where: { id: childId },
    select: { id: true, classId: true },
  })
  if (!child) {
    throw new Error("Not found")
  }

  if (!child.classId) {
    // A child with no class is admin-only
    if (!access.isAdmin && !(access.canRead && !write && access.visibleClassIds === "all")) {
      throw new Error("Forbidden")
    }
    return child
  }

  const allowed = write
    ? canServeClass(access, child.classId)
    : canViewClass(access, child.classId)
  if (!allowed) {
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

    const access = await getSundaySchoolAccess(user)
    if (!access.canRead) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await loadChildForUser(id, access, false)

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

    const access = await getSundaySchoolAccess(user)
    await loadChildForUser(id, access, true)

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
      // Moving a child needs authority over the destination too, or a servant
      // could push a child into a class they have nothing to do with.
      if (classId ? !canServeClass(access, classId) : !access.isAdmin) {
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

    const access = await getSundaySchoolAccess(user)
    await loadChildForUser(id, access, true)

    await prisma.sundaySchoolChild.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
