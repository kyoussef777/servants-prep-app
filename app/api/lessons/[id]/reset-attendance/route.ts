import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canManageCurriculum } from "@/lib/roles"
import { handleApiError } from "@/lib/api-utils"

// POST /api/lessons/[id]/reset-attendance
// Deletes all attendance records for a lesson and resets its status to SCHEDULED.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    if (!canManageCurriculum(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params

    const lesson = await prisma.lesson.findUnique({ where: { id } })
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.attendanceRecord.deleteMany({ where: { lessonId: id } }),
      prisma.lesson.update({ where: { id }, data: { status: "SCHEDULED" } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
