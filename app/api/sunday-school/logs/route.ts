import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { UserRole, SundaySchoolLogStatus } from "@prisma/client"
import { isAdmin } from "@/lib/roles"
import { getMentorStudentIds } from "@/lib/api-utils"
import { getWeekNumber } from "@/lib/sunday-school-utils"

// GET /api/sunday-school/logs - List logs with filters
// Query params:
//   ?assignmentId=xxx - filter by assignment
//   ?studentId=xxx - filter by student
//   ?status=VERIFIED - filter by status
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const assignmentId = searchParams.get("assignmentId")
    const studentId = searchParams.get("studentId")
    const status = searchParams.get("status")

    const where: Record<string, unknown> = {}
    if (assignmentId) where.assignmentId = assignmentId
    if (status) where.status = status as SundaySchoolLogStatus

    // Role-based filtering
    if (user.role === UserRole.STUDENT) {
      where.assignment = { studentId: user.id }
    } else if (user.role === UserRole.MENTOR) {
      const menteeIds = await getMentorStudentIds(user.id, user.role)
      if (menteeIds) {
        where.assignment = { studentId: { in: menteeIds } }
      }
    } else if (!isAdmin(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // If a studentId filter is provided (and user has access), scope to that student
    if (studentId) {
      where.assignment = { ...(where.assignment as Record<string, unknown> || {}), studentId }
    }

    const logs = await prisma.sundaySchoolLog.findMany({
      where,
      include: {
        assignment: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        code: {
          select: {
            id: true,
            code: true,
            grade: true,
          },
        },
        marker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ weekOf: "desc" }],
    })

    return NextResponse.json(logs)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch logs" },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 }
    )
  }
}

// POST /api/sunday-school/logs - Student submits attendance code
// Body: { code, weekOf, studentNotes? }
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    // Only STUDENT role can submit codes
    if (user.role !== UserRole.STUDENT) {
      return NextResponse.json(
        { error: "Only students can submit attendance codes" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { code, weekOf, studentNotes } = body

    if (!code || !weekOf) {
      return NextResponse.json(
        { error: "Missing required fields: code, weekOf" },
        { status: 400 }
      )
    }

    // Validate weekOf is a valid date
    const weekOfDate = new Date(weekOf)
    if (isNaN(weekOfDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format for weekOf" },
        { status: 400 }
      )
    }
    weekOfDate.setHours(0, 0, 0, 0)

    // Verify student is async and has an active assignment
    const assignment = await prisma.sundaySchoolAssignment.findFirst({
      where: {
        studentId: user.id,
        isActive: true,
      },
      include: {
        student: {
          include: {
            enrollments: {
              where: { studentId: user.id },
              select: { isAsyncStudent: true },
            },
          },
        },
      },
    })

    if (!assignment) {
      return NextResponse.json(
        { error: "No active Sunday School assignment found" },
        { status: 404 }
      )
    }

    // Verify student is async
    const enrollment = assignment.student.enrollments[0]
    if (!enrollment || !enrollment.isAsyncStudent) {
      return NextResponse.json(
        { error: "Only async students can submit Sunday School attendance codes" },
        { status: 403 }
      )
    }

    // Validate weekOf falls within assignment period
    const assignmentStart = new Date(assignment.startDate)
    assignmentStart.setHours(0, 0, 0, 0)
    const assignmentEnd = new Date(assignmentStart)
    assignmentEnd.setDate(assignmentEnd.getDate() + assignment.totalWeeks * 7)

    if (weekOfDate < assignmentStart || weekOfDate >= assignmentEnd) {
      return NextResponse.json(
        { error: "The submitted week does not fall within your assignment period" },
        { status: 400 }
      )
    }

    // Look up the code in the database
    const sundaySchoolCode = await prisma.sundaySchoolCode.findUnique({
      where: { code: code.trim().toUpperCase() },
    })

    if (!sundaySchoolCode) {
      return NextResponse.json(
        { error: "Invalid attendance code" },
        { status: 404 }
      )
    }

    // Check if code is active
    if (!sundaySchoolCode.isActive) {
      return NextResponse.json(
        { error: "This code has been deactivated" },
        { status: 410 }
      )
    }

    // Check if code is expired
    if (new Date() > sundaySchoolCode.validUntil) {
      return NextResponse.json(
        { error: "This code has expired" },
        { status: 410 }
      )
    }

    // Verify grade matches
    if (sundaySchoolCode.grade !== assignment.grade) {
      return NextResponse.json(
        { error: "This code is for a different grade than your assignment" },
        { status: 422 }
      )
    }

    // Calculate week number
    const weekNumber = getWeekNumber(assignment.startDate, weekOfDate)
    if (!weekNumber || weekNumber < 1 || weekNumber > assignment.totalWeeks) {
      return NextResponse.json(
        { error: "Invalid week number for this assignment" },
        { status: 400 }
      )
    }

    // Check for existing log for this week
    const existingLog = await prisma.sundaySchoolLog.findUnique({
      where: {
        assignmentId_weekNumber: {
          assignmentId: assignment.id,
          weekNumber,
        },
      },
    })

    if (existingLog) {
      // If the existing log was REJECTED, allow re-submission by updating it
      if (existingLog.status === SundaySchoolLogStatus.REJECTED) {
        const updatedLog = await prisma.sundaySchoolLog.update({
          where: { id: existingLog.id },
          data: {
            status: SundaySchoolLogStatus.VERIFIED,
            codeId: sundaySchoolCode.id,
            studentNotes: studentNotes || existingLog.studentNotes,
            notes: null, // Clear admin rejection notes
            markedBy: null,
          },
          include: {
            assignment: {
              select: {
                id: true,
                grade: true,
                studentId: true,
              },
            },
          },
        })

        return NextResponse.json(updatedLog, { status: 201 })
      }

      // Any other status means already logged
      return NextResponse.json(
        { error: "Attendance already logged for this week" },
        { status: 409 }
      )
    }

    // Create new log entry
    const log = await prisma.sundaySchoolLog.create({
      data: {
        assignmentId: assignment.id,
        weekNumber,
        weekOf: weekOfDate,
        status: SundaySchoolLogStatus.VERIFIED,
        codeId: sundaySchoolCode.id,
        studentNotes: studentNotes || null,
      },
      include: {
        assignment: {
          select: {
            id: true,
            grade: true,
            studentId: true,
          },
        },
      },
    })

    return NextResponse.json(log, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit attendance code" },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 }
    )
  }
}
