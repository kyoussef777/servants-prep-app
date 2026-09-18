import { NextResponse } from "next/server"
import { del } from "@vercel/blob"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canManageData } from "@/lib/roles"
import { applyExpectedAbsenceToRecords, handleApiError, reconcileLateStartAttendance } from "@/lib/api-utils"

// DELETE /api/slips/[id] - Remove a slip. Lessons an attendance slip marked
// PRESENT go back to ABSENT (or N/A for a late start or N/A expected absence);
// lessons a servant has since changed by hand keep their status.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    if (!canManageData(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const slip = await prisma.studentSlip.findUnique({ where: { id } })
    if (!slip) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      if (slip.type === "ATTENDANCE") {
        await tx.attendanceRecord.updateMany({
          where: { slipId: id, status: "PRESENT" },
          data: { status: "ABSENT", notes: null },
        })
        // Restore what the slip displaced: late-start N/A and expected-absence links
        const enrollment = await tx.studentEnrollment.findUnique({ where: { studentId: slip.studentId }, select: { attendanceStartDate: true } })
        if (enrollment?.attendanceStartDate) {
          await reconcileLateStartAttendance(slip.studentId, enrollment.attendanceStartDate, tx)
        }
        for (const expectedAbsence of await tx.expectedAbsence.findMany({ where: { studentId: slip.studentId } })) {
          await applyExpectedAbsenceToRecords(expectedAbsence, tx)
        }
      }
      await tx.studentSlip.delete({ where: { id } }) // FK sets remaining records' slipId to null
    })

    await del(slip.imageUrl, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
