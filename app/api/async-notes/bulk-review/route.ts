import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { NoteSubmissionStatus, AttendanceStatus } from "@prisma/client"
import { canReviewAsyncNotes } from "@/lib/roles"
import { handleApiError } from "@/lib/api-utils"

// POST /api/async-notes/bulk-review - Bulk review submissions
// Auth: SUPER_ADMIN, SERVANT_PREP only
// Body: { submissionIds: string[], status: "APPROVED" | "REJECTED", feedback?: string }
// Note: No bulk revert (PENDING) - only APPROVED/REJECTED
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    // Only SUPER_ADMIN and SERVANT_PREP can review
    if (!canReviewAsyncNotes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { submissionIds, status, feedback } = body

    if (!submissionIds || !Array.isArray(submissionIds) || submissionIds.length === 0) {
      return NextResponse.json(
        { error: "submissionIds array is required" },
        { status: 400 }
      )
    }

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be APPROVED or REJECTED" },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      // Fetch submissions inside transaction for fresh data
      const submissions = await tx.asyncNoteSubmission.findMany({
        where: {
          id: { in: submissionIds },
        },
        include: {
          lesson: {
            select: {
              id: true,
            },
          },
        },
      })

      if (submissions.length === 0) {
        throw new Error("No submissions found")
      }

      let processed = 0

      for (const submission of submissions) {
        // Skip if already in the target status
        if (submission.status === status) {
          continue
        }

        if (status === "APPROVED") {
          // Skip if already approved
          if (submission.status === NoteSubmissionStatus.APPROVED) {
            continue
          }

          // Create or update attendance record
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
              notes: "Async note submission approved (bulk)",
            },
            create: {
              lessonId: submission.lessonId,
              studentId: submission.studentId,
              status: AttendanceStatus.PRESENT,
              recordedBy: user.id,
              notes: "Async note submission approved (bulk)",
            },
          })

          // Update submission
          await tx.asyncNoteSubmission.update({
            where: { id: submission.id },
            data: {
              status: NoteSubmissionStatus.APPROVED,
              reviewedBy: user.id,
              reviewedAt: new Date(),
              reviewFeedback: feedback || null,
              attendanceRecordId: attendanceRecord.id,
            },
          })

          processed++
        } else if (status === "REJECTED") {
          // Skip if already rejected
          if (submission.status === NoteSubmissionStatus.REJECTED) {
            continue
          }

          // If previously approved, delete the linked attendance record
          if (
            submission.status === NoteSubmissionStatus.APPROVED &&
            submission.attendanceRecordId
          ) {
            await tx.attendanceRecord.delete({
              where: { id: submission.attendanceRecordId },
            })
          }

          // Update submission
          await tx.asyncNoteSubmission.update({
            where: { id: submission.id },
            data: {
              status: NoteSubmissionStatus.REJECTED,
              reviewedBy: user.id,
              reviewedAt: new Date(),
              reviewFeedback: feedback || null,
              attendanceRecordId: null,
            },
          })

          processed++
        }
      }

      return processed
    })

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${result} submission(s)`,
      count: result,
    })
  } catch (error: unknown) {
    console.error("Bulk review error:", error)
    return handleApiError(error)
  }
}
