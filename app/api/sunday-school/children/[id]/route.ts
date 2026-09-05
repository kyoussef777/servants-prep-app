import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { handleApiError } from "@/lib/api-utils"
import {
  canCoordinateClass,
  canServeClass,
  canViewClass,
  getSundaySchoolAccess,
  visibleClassFilter,
  type SundaySchoolAccess,
} from "@/lib/sunday-school-access"
import { isValidLevel } from "@/lib/sunday-school-class"
import {
  hasSundaySchoolFamilyDetails,
  normalizeSundaySchoolFamilyDetails,
  sundaySchoolFamilyInclude,
} from "@/lib/sunday-school-family"

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
    select: { id: true, classId: true, familyId: true },
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

async function canAccessFamily(familyId: string, access: SundaySchoolAccess) {
  const allowedClassIds = visibleClassFilter(access)
  return prisma.sundaySchoolFamily.findFirst({
    where: {
      id: familyId,
      ...(allowedClassIds
        ? { children: { some: { classId: { in: allowedClassIds } } } }
        : {}),
    },
    select: { id: true },
  })
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
        family: { include: sundaySchoolFamilyInclude },
        user: { select: { id: true, name: true, email: true } },
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
    const currentChild = await loadChildForUser(id, access, true)

    const body = await request.json()
    const {
      firstName,
      lastName,
      level,
      classId,
      birthDate,
      familyId,
      family,
      guardianName,
      guardianPhone,
      guardianEmail,
      notes,
      isActive,
      linkedUserEmail,
    } = body

    const updateData: Record<string, unknown> = {}
    const familyDetails = family === undefined
      ? undefined
      : normalizeSundaySchoolFamilyDetails(family)

    if (family !== undefined && family !== null && !familyDetails) {
      return NextResponse.json({ error: "Invalid family details" }, { status: 400 })
    }

    if (familyId !== undefined && familyId !== null && typeof familyId !== "string") {
      return NextResponse.json({ error: "Invalid family" }, { status: 400 })
    }

    const requestedFamilyId = familyId === undefined
      ? undefined
      : typeof familyId === "string"
        ? familyId.trim() || null
        : null

    if (
      requestedFamilyId &&
      requestedFamilyId !== currentChild.familyId &&
      !(await canAccessFamily(requestedFamilyId, access))
    ) {
      return NextResponse.json(
        { error: "You can only link a child to a family you can view" },
        { status: 403 }
      )
    }

    if (requestedFamilyId !== undefined) updateData.familyId = requestedFamilyId

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
    if (linkedUserEmail !== undefined) {
      if (!access.isAdmin && (!currentChild.classId || !canCoordinateClass(access, currentChild.classId))) {
        return NextResponse.json(
          { error: "Only a coordinator can link a child account" },
          { status: 403 }
        )
      }

      const email = String(linkedUserEmail).trim().toLowerCase()
      if (!email) {
        updateData.userId = null
      } else {
        const account = await prisma.user.findUnique({
          where: { email },
          select: { id: true, role: true, isDisabled: true },
        })
        if (!account || account.role !== "STUDENT" || account.isDisabled) {
          return NextResponse.json(
            { error: "Enter the email of an active student account" },
            { status: 400 }
          )
        }
        const existingLink = await prisma.sundaySchoolChild.findFirst({
          where: { userId: account.id, id: { not: id } },
          select: { id: true },
        })
        if (existingLink) {
          return NextResponse.json(
            { error: "That student account is already linked to another child" },
            { status: 400 }
          )
        }
        updateData.userId = account.id
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      let resolvedFamilyId = requestedFamilyId === undefined
        ? currentChild.familyId
        : requestedFamilyId

      if (resolvedFamilyId && familyDetails) {
        await tx.sundaySchoolFamily.update({
          where: { id: resolvedFamilyId },
          data: familyDetails,
        })
      } else if (!resolvedFamilyId && hasSundaySchoolFamilyDetails(familyDetails ?? null)) {
        const createdFamily = await tx.sundaySchoolFamily.create({ data: familyDetails! })
        resolvedFamilyId = createdFamily.id
        updateData.familyId = resolvedFamilyId
      }

      return tx.sundaySchoolChild.update({
        where: { id },
        data: updateData,
        include: {
          class: { select: { id: true, name: true, level: true } },
          family: { include: sundaySchoolFamilyInclude },
          user: { select: { id: true, name: true, email: true } },
        },
      })
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
