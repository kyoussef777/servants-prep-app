import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { NoteSubmissionStatus, AttendanceStatus } from "@prisma/client"
import { canReviewAsyncNotes } from "@/lib/roles"
import { handleApiError } from "@/lib/api-utils"

// POST /api/async-notes/[id]/review - Review (approve/reject/revert) a submission
// Auth: SUPER_ADMIN, SERVANT_PREP only
// Body: { status: "APPROVED" | "REJECTED" | "PENDING", feedback?: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Only SUPER_ADMIN and SERVANT_PREP can review
    if (!canReviewAsyncNotes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { status, feedback } = body

    if (!status || !["APPROVED", "REJECTED", "PENDING"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be APPROVED, REJECTED, or PENDING" },
        { status: 400 }
      )
    }

    const submission = await prisma.asyncNoteSubmission.findUnique({
      where: { id },
      include: {
        lesson: {
          select: {
            id: true,
            academicYearId: true,
          },
        },
      },
    })

    if (!submission) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Validate status transitions
    if (status === "APPROVED" && submission.status === NoteSubmissionStatus.APPROVED) {
      return NextResponse.json(
        { error: "Submission is already approved" },
        { status: 400 }
      )
    }

    if (status === "REJECTED" && submission.status === NoteSubmissionStatus.REJECTED) {
      return NextResponse.json(
        { error: "Submission is already rejected" },
        { status: 400 }
      )
    }

    if (status === "PENDING" && submission.status === NoteSubmissionStatus.PENDING) {
      return NextResponse.json(
        { error: "Submission is already pending" },
        { status: 400 }
      )
    }

    // Handle APPROVED
    if (status === "APPROVED") {
      const result = await prisma.$transaction(async (tx) => {
        // Create or update attendance record (PRESENT, recorded by reviewer)
        const attendanceRecord = await tx.attendanceRecord.upsert({
          where: {
            lessonId_studentId: {
              lessonId: submission.lessonId,
              studentId: submission.studentId,
            },
          },
          update: {
            status: AttendanceStatus.PRESENT,
            recordedBy: user.id,
            notes: "Async note submission approved",
          },
          create: {
            lessonId: submission.lessonId,
            studentId: submission.studentId,
            status: AttendanceStatus.PRESENT,
            recordedBy: user.id,
            notes: "Async note submission approved",
          },
        })

        // Update submission with approval and link attendance record
        const updated = await tx.asyncNoteSubmission.update({
          where: { id },
          data: {
            status: NoteSubmissionStatus.APPROVED,
            reviewedBy: user.id,
            reviewedAt: new Date(),
            reviewFeedback: feedback || null,
            attendanceRecordId: attendanceRecord.id,
          },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            lesson: {
              select: {
                id: true,
                title: true,
                lessonNumber: true,
              },
            },
            reviewer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        return updated
      })

      return NextResponse.json(result)
    }

    // Handle REJECTED
    if (status === "REJECTED") {
      const result = await prisma.$transaction(async (tx) => {
        // If previously approved, delete the linked attendance record
        if (
          submission.status === NoteSubmissionStatus.APPROVED &&
          submission.attendanceRecordId
        ) {
          await tx.attendanceRecord.delete({
            where: { id: submission.attendanceRecordId },
          })
        }

        // Update submission with rejection
        const updated = await tx.asyncNoteSubmission.update({
          where: { id },
          data: {
            status: NoteSubmissionStatus.REJECTED,
            reviewedBy: user.id,
            reviewedAt: new Date(),
            reviewFeedback: feedback || null,
            attendanceRecordId: null,
          },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            lesson: {
              select: {
                id: true,
                title: true,
                lessonNumber: true,
              },
            },
            reviewer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        return updated
      })

      return NextResponse.json(result)
    }

    // Handle PENDING (revert)
    if (status === "PENDING") {
      const result = await prisma.$transaction(async (tx) => {
        // Delete linked attendance record if it exists
        if (submission.attendanceRecordId) {
          await tx.attendanceRecord.delete({
            where: { id: submission.attendanceRecordId },
          })
        }

        // Clear all review fields and reset to PENDING
        const updated = await tx.asyncNoteSubmission.update({
          where: { id },
          data: {
            status: NoteSubmissionStatus.PENDING,
            reviewedBy: null,
            reviewedAt: null,
            reviewFeedback: null,
            attendanceRecordId: null,
          },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            lesson: {
              select: {
                id: true,
                title: true,
                lessonNumber: true,
              },
            },
            reviewer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        return updated
      })

      return NextResponse.json(result)
    }

    // Should not reach here due to validation above
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
