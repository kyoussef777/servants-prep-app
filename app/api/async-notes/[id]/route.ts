import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { UserRole, NoteSubmissionStatus } from "@prisma/client"
import { isAdmin } from "@/lib/roles"
import { getMentorStudentIds, handleApiError } from "@/lib/api-utils"

// GET /api/async-notes/[id] - Get a single submission
// Auth: own submission (student), mentees (mentor), all (admin)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const submission = await prisma.asyncNoteSubmission.findUnique({
      where: { id },
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
            subtitle: true,
            scheduledDate: true,
            lessonNumber: true,
            examSection: {
              select: {
                id: true,
                name: true,
                displayName: true,
              },
            },
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

    if (!submission) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Authorization check
    if (user.role === UserRole.STUDENT) {
      if (submission.studentId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else if (user.role === UserRole.MENTOR) {
      const menteeIds = await getMentorStudentIds(user.id, user.role)
      if (menteeIds && !menteeIds.includes(submission.studentId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else if (!isAdmin(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(submission)
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// PUT /api/async-notes/[id] - Update submission content
// Auth: STUDENT, own submission only, PENDING or REJECTED status only
// Body: { content: string }
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Only students can update their own submissions
    if (user.role !== UserRole.STUDENT) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { content } = body

    if (!content) {
      return NextResponse.json(
        { error: "Missing required field: content" },
        { status: 400 }
      )
    }

    const submission = await prisma.asyncNoteSubmission.findUnique({
      where: { id },
    })

    if (!submission) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Must be own submission
    if (submission.studentId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Can only update PENDING or REJECTED submissions
    if (
      submission.status !== NoteSubmissionStatus.PENDING &&
      submission.status !== NoteSubmissionStatus.REJECTED
    ) {
      return NextResponse.json(
        { error: "Cannot update an approved submission" },
        { status: 400 }
      )
    }

    // If status is REJECTED, reset to PENDING and clear review fields
    const updateData: Record<string, unknown> = { content }
    if (submission.status === NoteSubmissionStatus.REJECTED) {
      updateData.status = NoteSubmissionStatus.PENDING
      updateData.reviewedBy = null
      updateData.reviewedAt = null
      updateData.reviewFeedback = null
      updateData.submittedAt = new Date()
    }

    const updated = await prisma.asyncNoteSubmission.update({
      where: { id },
      data: updateData,
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
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// DELETE /api/async-notes/[id] - Delete a submission
// Auth: STUDENT, own submission only, PENDING status only
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Only students can delete their own submissions
    if (user.role !== UserRole.STUDENT) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const submission = await prisma.asyncNoteSubmission.findUnique({
      where: { id },
    })

    if (!submission) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Must be own submission
    if (submission.studentId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Can only delete PENDING submissions
    if (submission.status !== NoteSubmissionStatus.PENDING) {
      return NextResponse.json(
        { error: "Can only delete pending submissions" },
        { status: 400 }
      )
    }

    await prisma.asyncNoteSubmission.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
