import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canSelfAssignMentees } from "@/lib/roles"

// POST /api/enrollments/unassign-mentor - Servant removes themselves as mentor from a student
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    // Check if user has permission to self-assign/unassign mentees
    if (!canSelfAssignMentees(user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to unassign mentees" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { studentId } = body

    if (!studentId) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      )
    }

    // Check if enrollment exists and this servant is the mentor
    const enrollment = await prisma.studentEnrollment.findUnique({
      where: { studentId }
    })

    if (!enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found" },
        { status: 404 }
      )
    }

    if (enrollment.mentorId !== user.id) {
      return NextResponse.json(
        { error: "You are not the mentor for this student" },
        { status: 403 }
      )
    }

    // Remove mentor assignment (set mentorId to null)
    const updatedEnrollment = await prisma.studentEnrollment.update({
      where: { studentId },
      data: { mentorId: null },
      include: {
        student: true
      }
    })

    return NextResponse.json(updatedEnrollment)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unassign mentee" },
      { status: 500 }
    )
  }
}
