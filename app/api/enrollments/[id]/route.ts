import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"

import { canAssignMentors } from "@/lib/roles"

// PATCH /api/enrollments/[id] - Update an enrollment (Admin who can assign mentors)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Check if user has permission to assign mentors
    if (!canAssignMentors(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { yearLevel, mentorId, isActive, status, notes } = body

    const updateData: any = {}
    if (yearLevel) updateData.yearLevel = yearLevel
    if (mentorId !== undefined) updateData.mentorId = mentorId || null
    if (isActive !== undefined) updateData.isActive = isActive
    if (status !== undefined) updateData.status = status
    if (notes !== undefined) updateData.notes = notes

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
