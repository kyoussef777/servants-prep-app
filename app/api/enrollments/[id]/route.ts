import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"

import { canAssignMentors, isAdmin } from "@/lib/roles"

// PATCH /api/enrollments/[id] - Update an enrollment
// - SUPER_ADMIN/PRIEST: Can update all fields including mentor assignment
// - SERVANT_PREP: Can update yearLevel, status, notes, isActive (but NOT mentorId)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Check if user has admin access
    if (!isAdmin(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { yearLevel, mentorId, isActive, status, notes, academicYearId } = body

    const updateData: Record<string, unknown> = {}
    if (yearLevel) updateData.yearLevel = yearLevel
    // Only SUPER_ADMIN/PRIEST can change mentor assignment
    if (mentorId !== undefined && canAssignMentors(user.role)) {
      updateData.mentorId = mentorId || null
    }
    if (isActive !== undefined) updateData.isActive = isActive
    if (notes !== undefined) updateData.notes = notes
    if (academicYearId !== undefined) updateData.academicYearId = academicYearId || null

    // Handle graduation status change
    if (status !== undefined) {
      updateData.status = status

      // When marking as GRADUATED, set the graduation academic year and date
      if (status === 'GRADUATED') {
        updateData.graduatedAt = new Date()

        // Use the active academic year as the graduation year
        const activeYear = await prisma.academicYear.findFirst({
          where: { isActive: true }
        })
        if (activeYear) {
          updateData.graduatedAcademicYearId = activeYear.id
        }
      } else if (status === 'ACTIVE') {
        // If reactivating, clear graduation data
        updateData.graduatedAt = null
        updateData.graduatedAcademicYearId = null
      }
    }

    const enrollment = await prisma.studentEnrollment.update({
      where: { id },
      data: updateData,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        mentor: {
          select: {
            id: true,
            name: true,
          }
        },
        academicYear: {
          select: {
            id: true,
            name: true,
          }
        },
        graduatedAcademicYear: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    return NextResponse.json(enrollment)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update enrollment" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}
