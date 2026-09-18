import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"

import { canAssignMentors, canManageEnrollments, canSetAsyncStatus } from "@/lib/roles"
import { notifyMentorAssigned } from "@/lib/notifications"
import { enrollmentStatusUpdate, reconcileLateStartAttendance } from "@/lib/api-utils"

// PATCH /api/enrollments/[id] - Update an enrollment
// - SUPER_ADMIN: Can update all fields including mentor assignment
// - SERVANT_PREP: Can update yearLevel, status, notes, isActive, mentorId
// - PRIEST: Read-only, cannot update enrollments
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // PRIEST is read-only, only SUPER_ADMIN and SERVANT_PREP can manage enrollments
    if (!canManageEnrollments(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { yearLevel, mentorId, isActive, status, notes, academicYearId, fatherOfConfessionId, isAsyncStudent, asyncReason, attendanceStartDate, graduationNote } = body

    const updateData: Record<string, unknown> = {}
    if (yearLevel) updateData.yearLevel = yearLevel
    // Only SUPER_ADMIN/SERVANT_PREP can change mentor assignment
    if (mentorId !== undefined && canAssignMentors(user.role)) {
      updateData.mentorId = mentorId || null
    }
    if (isActive !== undefined) updateData.isActive = isActive
    if (notes !== undefined) updateData.notes = notes
    if (academicYearId !== undefined) updateData.academicYearId = academicYearId || null
    if (fatherOfConfessionId !== undefined) updateData.fatherOfConfessionId = fatherOfConfessionId || null

    // Late-start attendance date. Tracks whether it changed so we can reconcile
    // the student's attendance records after the update.
    let attendanceStartChanged = false
    let newAttendanceStart: Date | null = null
    if (attendanceStartDate !== undefined) {
      if (attendanceStartDate) {
        const parsed = new Date(attendanceStartDate)
        if (isNaN(parsed.getTime())) {
          return NextResponse.json({ error: "Invalid attendance start date" }, { status: 400 })
        }
        newAttendanceStart = parsed
      }
      updateData.attendanceStartDate = newAttendanceStart
      attendanceStartChanged = true
    }

    // Async status and reason (the reason can be edited on its own)
    if (isAsyncStudent !== undefined || asyncReason !== undefined) {
      if (!canSetAsyncStatus(user.role)) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to set async student status" },
          { status: 403 }
        )
      }
      if (isAsyncStudent === true) {
        updateData.isAsyncStudent = true
        updateData.asyncApprovedAt = new Date()
        updateData.asyncApprovedBy = user.id
      }
      if (asyncReason !== undefined) updateData.asyncReason = asyncReason || null
      if (isAsyncStudent === false) {
        updateData.isAsyncStudent = false
        updateData.asyncApprovedAt = null
        updateData.asyncApprovedBy = null
        updateData.asyncReason = null
      }
    }

    if (status !== undefined) {
      Object.assign(updateData, await enrollmentStatusUpdate(status, graduationNote))
    }

    const enrollment = await prisma.$transaction(async (tx) => {
      const updated = await tx.studentEnrollment.update({
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
          },
          fatherOfConfession: {
            select: {
              id: true,
              name: true,
              phone: true,
              church: true,
            }
          }
        }
      })

      // Reconcile late-start attendance atomically when the start date changed
      if (attendanceStartChanged) {
        await reconcileLateStartAttendance(updated.studentId, newAttendanceStart, tx)
      }

      return updated
    })

    // Notify student when a mentor is assigned (non-blocking)
    if (mentorId && enrollment.mentor) {
      notifyMentorAssigned({
        studentId: enrollment.student.id,
        mentorName: enrollment.mentor.name,
      }).catch(() => {})
    }

    return NextResponse.json(enrollment)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update enrollment" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}
