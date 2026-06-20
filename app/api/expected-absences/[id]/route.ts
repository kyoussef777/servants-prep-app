import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canManageData } from "@/lib/roles"
import { handleApiError } from "@/lib/api-utils"

// DELETE /api/expected-absences/[id] - Remove an expected absence.
// Linked attendance records are reverted: lessons that predate the student's
// attendance start date stay EXCUSED (late start), everything else goes back
// to ABSENT with the reason note cleared.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    if (!canManageData(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const absence = await prisma.expectedAbsence.findUnique({
      where: { id },
      select: { id: true, studentId: true },
    })
    if (!absence) {
      return NextResponse.json({ error: "Expected absence not found" }, { status: 404 })
    }

    const enrollment = await prisma.studentEnrollment.findUnique({
      where: { studentId: absence.studentId },
      select: { attendanceStartDate: true },
    })
    const startDate = enrollment?.attendanceStartDate ?? null

    await prisma.$transaction(async (tx) => {
      // Find records auto-excused by this expected absence
      const linked = await tx.attendanceRecord.findMany({
        where: { expectedAbsenceId: id },
        select: { id: true, lesson: { select: { scheduledDate: true } } },
      })

      for (const record of linked) {
        const beforeStart = startDate !== null && record.lesson.scheduledDate < startDate
        await tx.attendanceRecord.update({
          where: { id: record.id },
          data: beforeStart
            ? { expectedAbsenceId: null, notes: null, status: "EXCUSED", notEnrolledYet: true }
            : { expectedAbsenceId: null, notes: null, status: "ABSENT", notEnrolledYet: false },
        })
      }

      await tx.expectedAbsence.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
