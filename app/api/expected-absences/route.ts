import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/roles"
import { handleApiError } from "@/lib/api-utils"

// GET /api/expected-absences?lessonId=xxx
// Returns the expected absences that cover a given lesson's date, keyed for the
// attendance page so it can flag students and pre-fill the excuse reason.
export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    if (!isAdmin(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const lessonId = searchParams.get("lessonId")
    if (!lessonId) {
      return NextResponse.json({ error: "lessonId is required" }, { status: 400 })
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { scheduledDate: true },
    })
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    const absences = await prisma.expectedAbsence.findMany({
      where: {
        startDate: { lte: lesson.scheduledDate },
        endDate: { gte: lesson.scheduledDate },
      },
      select: { id: true, studentId: true, reason: true, startDate: true, endDate: true },
    })

    return NextResponse.json(absences)
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
