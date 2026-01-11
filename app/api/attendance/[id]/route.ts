import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { AttendanceStatus } from "@prisma/client"
import { canManageData } from "@/lib/roles"

// PATCH /api/attendance/[id] - Update attendance record (SUPER_ADMIN and SERVANT_PREP only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // PRIEST is read-only, only SUPER_ADMIN and SERVANT_PREP can manage attendance
    if (!canManageData(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }
    const body = await request.json()
    const { status, arrivedAt, notes } = body

    // Check if record exists
    const record = await prisma.attendanceRecord.findUnique({
      where: { id },
      include: {
        lesson: true
      }
    })

    if (!record) {
      return NextResponse.json(
        { error: "Attendance record not found" },
        { status: 404 }
      )
    }

    // Note: Admins can edit attendance records at any time

    const updateData: { status?: AttendanceStatus; arrivedAt?: Date | null; notes?: string } = {}
    if (status) updateData.status = status
    if (arrivedAt !== undefined) {
      // Validate arrivedAt - only set if it's a valid date
      if (arrivedAt && typeof arrivedAt === 'string' && arrivedAt.trim()) {
        const parsedDate = new Date(arrivedAt)
        updateData.arrivedAt = !isNaN(parsedDate.getTime()) ? parsedDate : null
      } else {
        updateData.arrivedAt = null
      }
    }
    if (notes !== undefined) updateData.notes = notes

    const updatedRecord = await prisma.attendanceRecord.update({
      where: { id },
      data: updateData,
      include: {
        student: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    return NextResponse.json(updatedRecord)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update attendance record" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}
