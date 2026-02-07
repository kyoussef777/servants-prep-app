import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { SundaySchoolLogStatus } from "@prisma/client"
import { canManageSundaySchoolAttendance } from "@/lib/roles"

const ALLOWED_STATUSES: SundaySchoolLogStatus[] = [
  SundaySchoolLogStatus.MANUAL,
  SundaySchoolLogStatus.EXCUSED,
  SundaySchoolLogStatus.REJECTED,
]

// POST /api/sunday-school/logs/admin-action - Admin marks attendance
// Body: { assignmentId, weekNumber, status: "MANUAL" | "EXCUSED" | "REJECTED", notes? }
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    if (!canManageSundaySchoolAttendance(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { assignmentId, weekNumber, status, notes } = body

    if (!assignmentId || !weekNumber || !status) {
      return NextResponse.json(
        { error: "Missing required fields: assignmentId, weekNumber, status" },
        { status: 400 }
      )
    }

    if (!ALLOWED_STATUSES.includes(status as SundaySchoolLogStatus)) {
      return NextResponse.json(
        { error: "Invalid status. Must be one of: MANUAL, EXCUSED, REJECTED" },
        { status: 400 }
      )
    }

    // Fetch the assignment to calculate weekOf
    const assignment = await prisma.sundaySchoolAssignment.findUnique({
      where: { id: assignmentId },
    })

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      )
    }

    // Validate weekNumber is within range
    if (weekNumber < 1 || weekNumber > assignment.totalWeeks) {
      return NextResponse.json(
        { error: `Week number must be between 1 and ${assignment.totalWeeks}` },
        { status: 400 }
      )
    }

    // Calculate weekOf from assignment startDate + (weekNumber-1) * 7 days
    const weekOf = new Date(assignment.startDate)
    weekOf.setDate(weekOf.getDate() + (weekNumber - 1) * 7)
    weekOf.setHours(0, 0, 0, 0)

    // Check if a log already exists for this week
    const existingLog = await prisma.sundaySchoolLog.findUnique({
      where: {
        assignmentId_weekNumber: {
          assignmentId,
          weekNumber,
        },
      },
    })

    if (existingLog) {
      // Update the existing log
      const updatedLog = await prisma.sundaySchoolLog.update({
        where: { id: existingLog.id },
        data: {
          status: status as SundaySchoolLogStatus,
          notes: notes || null,
          markedBy: user.id,
        },
        include: {
          assignment: {
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          marker: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      return NextResponse.json(updatedLog)
    }

    // Create new log entry
    const log = await prisma.sundaySchoolLog.create({
      data: {
        assignmentId,
        weekNumber,
        weekOf,
        status: status as SundaySchoolLogStatus,
        notes: notes || null,
        markedBy: user.id,
      },
      include: {
        assignment: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        marker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(log, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process admin action" },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 }
    )
  }
}
