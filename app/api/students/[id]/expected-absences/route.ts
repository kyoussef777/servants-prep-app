import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin, canManageData } from "@/lib/roles"
import { applyExpectedAbsenceToRecords, handleApiError } from "@/lib/api-utils"

// GET /api/students/[id]/expected-absences - List a student's expected absences
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: studentId } = await params

    // Students may view their own; admins can view any
    if (user.role === "STUDENT" && user.id !== studentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (user.role !== "STUDENT" && !isAdmin(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const absences = await prisma.expectedAbsence.findMany({
      where: { studentId },
      include: {
        creator: { select: { id: true, name: true } },
      },
      orderBy: { startDate: "desc" },
    })

    return NextResponse.json(absences)
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// POST /api/students/[id]/expected-absences - Create an expected absence
// Existing ABSENT records in the window are linked with the reason and stay
// Absent until manually excused; with markAsNA they are marked N/A instead
// (excluded from the attendance rate).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: studentId } = await params

    if (!canManageData(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { startDate, endDate, reason } = body
    const markAsNA = body.markAsNA === true

    if (!startDate || !endDate || !reason || !reason.trim()) {
      return NextResponse.json(
        { error: "Start date, end date, and reason are required" },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid date(s)" }, { status: 400 })
    }
    // Make the window inclusive of the whole final day so a lesson scheduled at
    // any time on the end date is covered.
    end.setUTCHours(23, 59, 59, 999)
    if (end < start) {
      return NextResponse.json(
        { error: "End date must be on or after the start date" },
        { status: 400 }
      )
    }

    // Verify the student exists
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true },
    })
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const absence = await prisma.$transaction(async (tx) => {
      const created = await tx.expectedAbsence.create({
        data: {
          studentId,
          startDate: start,
          endDate: end,
          reason: reason.trim(),
          markAsNA,
          createdBy: user.id,
        },
      })

      // Link existing attendance records within the window (Absent stays
      // Absent until manually excused; N/A mode excludes them from the rate)
      await applyExpectedAbsenceToRecords(
        {
          id: created.id,
          studentId,
          startDate: start,
          endDate: end,
          reason: reason.trim(),
          markAsNA,
        },
        tx
      )

      return created
    })

    return NextResponse.json(absence, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
