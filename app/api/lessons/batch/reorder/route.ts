import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canManageCurriculum } from "@/lib/roles"
import { handleApiError } from "@/lib/api-utils"

// POST /api/lessons/batch/reorder - Reorder lessons (dates stay in slots, topics move)
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    if (!canManageCurriculum(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { lessonIds } = body as { lessonIds: string[] }

    if (!lessonIds || !Array.isArray(lessonIds) || lessonIds.length < 2) {
      return NextResponse.json({ error: "At least 2 lesson IDs required" }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      // Fetch inside transaction for fresh data
      const lessons = await tx.lesson.findMany({
        where: { id: { in: lessonIds } },
        select: { id: true, scheduledDate: true, lessonNumber: true, academicYearId: true },
      })

      if (lessons.length !== lessonIds.length) {
        throw new Error("Some lesson IDs not found")
      }

      const lessonMap = new Map(lessons.map(l => [l.id, l]))

      // Group lesson IDs by academic year, preserving the new order from lessonIds
      const yearGroups = new Map<string, string[]>()
      for (const id of lessonIds) {
        const lesson = lessonMap.get(id)!
        const yearId = lesson.academicYearId
        if (!yearGroups.has(yearId)) yearGroups.set(yearId, [])
        yearGroups.get(yearId)!.push(id)
      }

      // For each academic year group independently:
      // - Collect date slots sorted by date descending (matching frontend visual order)
      // - Collect lesson number slots sorted descending (largest number = newest date)
      // - Reassign them positionally: ids[0] (top of visual) gets newest date + largest number
      for (const [, ids] of yearGroups) {
        const groupLessons = ids.map(id => lessonMap.get(id)!)

        // Date slots: sorted descending to match frontend display (newest first)
        const dates = [...groupLessons]
          .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
          .map(l => l.scheduledDate)

        // Lesson number slots: sorted descending (largest = newest lesson)
        const numbers = [...groupLessons]
          .sort((a, b) => b.lessonNumber - a.lessonNumber)
          .map(l => l.lessonNumber)

        // Step 1: set to negative temps to avoid unique constraint clashes
        for (let i = 0; i < ids.length; i++) {
          await tx.lesson.update({
            where: { id: ids[i] },
            data: { lessonNumber: -(i + 1) },
          })
        }

        // Step 2: assign real dates + lesson numbers in new order
        for (let i = 0; i < ids.length; i++) {
          await tx.lesson.update({
            where: { id: ids[i] },
            data: {
              scheduledDate: dates[i],
              lessonNumber: numbers[i],
            },
          })
        }
      }
    })

    return NextResponse.json({ reordered: lessonIds.length })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
