import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { UserRole, NoteSubmissionStatus } from "@prisma/client"
import { isAdmin, canViewStudents } from "@/lib/roles"
import { getMentorStudentIds, handleApiError } from "@/lib/api-utils"

// GET /api/async-notes - List async note submissions with filters
// Query params:
//   ?studentId=xxx - filter by student
//   ?lessonId=xxx - filter by lesson
//   ?status=PENDING|APPROVED|REJECTED - filter by status
//   ?academicYearId=xxx - filter by academic year (via lesson)
//   ?page=1&limit=50 - pagination (default: all results)
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const lessonId = searchParams.get("lessonId")
    const status = searchParams.get("status")
    const academicYearId = searchParams.get("academicYearId")
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!) : null
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50

    const where: Record<string, unknown> = {}

    // Role-based filtering
    if (user.role === UserRole.STUDENT) {
      // Students can only see their own submissions
      where.studentId = user.id
    } else if (user.role === UserRole.MENTOR) {
      // Mentors can only see their mentees' submissions
      const menteeIds = await getMentorStudentIds(user.id, user.role)
      if (menteeIds) {
        where.studentId = { in: menteeIds }
      }
    } else if (!isAdmin(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    // Admins (SUPER_ADMIN, PRIEST, SERVANT_PREP) can see all

    // Apply filters
    if (studentId) {
      // For students, ensure they can only filter to themselves
      if (user.role === UserRole.STUDENT && studentId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      // For mentors, ensure the studentId is in their mentee list
      if (user.role === UserRole.MENTOR) {
        const menteeIds = await getMentorStudentIds(user.id, user.role)
        if (!menteeIds || !menteeIds.includes(studentId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      }
      where.studentId = studentId
    }
    if (lessonId) where.lessonId = lessonId
    if (status) where.status = status as NoteSubmissionStatus
    if (academicYearId) {
      where.lesson = { academicYearId }
    }

    const queryOptions: {
      where: Record<string, unknown>
      include: Record<string, unknown>
      orderBy: { submittedAt: "desc" }
      skip?: number
      take?: number
    } = {
      where,
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
      orderBy: {
        submittedAt: "desc",
      },
    }

    // Add pagination if requested
    if (page !== null) {
      queryOptions.skip = (page - 1) * limit
      queryOptions.take = limit

      const [submissions, total] = await Promise.all([
        prisma.asyncNoteSubmission.findMany(queryOptions),
        prisma.asyncNoteSubmission.count({ where }),
      ])

      return NextResponse.json({
        data: submissions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    }

    // No pagination - return all
    const submissions = await prisma.asyncNoteSubmission.findMany(queryOptions)
    return NextResponse.json(submissions)
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// POST /api/async-notes - Submit notes for a lesson
// Body: { lessonId: string, content: string }
// Auth: STUDENT only, must be async student
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    // Only students can submit notes
    if (user.role !== UserRole.STUDENT) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { lessonId, content } = body

    if (!lessonId || !content) {
      return NextResponse.json(
        { error: "Missing required fields: lessonId and content" },
        { status: 400 }
      )
    }

    // Check that the student is enrolled as an async student
    const enrollment = await prisma.studentEnrollment.findUnique({
      where: { studentId: user.id },
    })

    if (!enrollment || !enrollment.isAsyncStudent) {
      return NextResponse.json(
        { error: "Only async students can submit notes" },
        { status: 403 }
      )
    }

    // Validate lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    })

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    // Check for existing submission
    const existing = await prisma.asyncNoteSubmission.findUnique({
      where: {
        studentId_lessonId: {
          studentId: user.id,
          lessonId,
        },
      },
    })

    if (existing) {
      // If existing submission was REJECTED, allow re-submission by updating it
      if (existing.status === NoteSubmissionStatus.REJECTED) {
        const updated = await prisma.asyncNoteSubmission.update({
          where: { id: existing.id },
          data: {
            content,
            status: NoteSubmissionStatus.PENDING,
            reviewedBy: null,
            reviewedAt: null,
            reviewFeedback: null,
            submittedAt: new Date(),
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
          },
        })

        return NextResponse.json(updated, { status: 201 })
      }

      // PENDING or APPROVED - cannot re-submit
      return NextResponse.json(
        { error: "A submission already exists for this lesson" },
        { status: 409 }
      )
    }

    // Create new submission
    const submission = await prisma.asyncNoteSubmission.create({
      data: {
        studentId: user.id,
        lessonId,
        content,
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
      },
    })

    return NextResponse.json(submission, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
