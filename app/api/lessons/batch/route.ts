import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canManageCurriculum } from "@/lib/roles"
import { handleApiError } from "@/lib/api-utils"
import { LessonStatus } from "@prisma/client"

interface LessonUpdate {
  id: string
  title?: string
  subtitle?: string
  description?: string
  speaker?: string
  scheduledDate?: string
  examSectionId?: string
  isExamDay?: boolean
  status?: string
  cancellationReason?: string
  resources?: { title: string; url: string }[]
}

const VALID_STATUSES = new Set<string>([
  LessonStatus.SCHEDULED,
  LessonStatus.COMPLETED,
  LessonStatus.CANCELLED,
])

/**
 * Validate a single lesson update object before persisting.
 * Throws an Error with a descriptive message on the first invalid field.
 */
function validateLessonUpdate(lesson: LessonUpdate, index: number): void {
  // Title must not be blank when provided
  if (lesson.title !== undefined && !lesson.title.trim()) {
    throw new Error(`Lesson at index ${index}: title cannot be empty`)
  }

  // scheduledDate must parse to a valid Date
  if (lesson.scheduledDate !== undefined) {
    const parsed = new Date(lesson.scheduledDate)
    if (isNaN(parsed.getTime())) {
      throw new Error(`Lesson at index ${index}: scheduledDate is not a valid date`)
    }
  }

  // status must be one of the LessonStatus enum values
  if (lesson.status !== undefined && !VALID_STATUSES.has(lesson.status)) {
    throw new Error(
      `Lesson at index ${index}: status must be one of SCHEDULED, COMPLETED, CANCELLED`
    )
  }

  // cancellationReason is required when setting status to CANCELLED
  if (
    lesson.status === LessonStatus.CANCELLED &&
    (!lesson.cancellationReason || !lesson.cancellationReason.trim())
  ) {
    throw new Error(
      `Lesson at index ${index}: cancellationReason is required when status is CANCELLED`
    )
  }
}

// PATCH /api/lessons/batch - Batch update multiple lessons
export async function PATCH(request: Request) {
  try {
    const user = await requireAuth()

    if (!canManageCurriculum(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { lessons } = body as { lessons: LessonUpdate[] }

    if (!lessons || !Array.isArray(lessons) || lessons.length === 0) {
      return NextResponse.json({ error: "No lessons provided" }, { status: 400 })
    }

    if (lessons.length > 100) {
      return NextResponse.json({ error: "Too many lessons (max 100)" }, { status: 400 })
    }

    // --- Pre-transaction validation ---

    // 1. Validate each lesson's fields synchronously
    for (let i = 0; i < lessons.length; i++) {
      validateLessonUpdate(lessons[i], i)

      // Validate resources if provided
      if (lessons[i].resources !== undefined) {
        for (let j = 0; j < lessons[i].resources!.length; j++) {
          const r = lessons[i].resources![j]
          if (!r.title || !r.title.trim()) {
            throw new Error(`Lesson at index ${i}: resource ${j} title cannot be empty`)
          }
          if (!r.url || !r.url.trim()) {
            throw new Error(`Lesson at index ${i}: resource ${j} URL cannot be empty`)
          }
        }
      }
    }

    // 2. Collect unique examSectionIds that need DB verification
    const examSectionIds = [
      ...new Set(
        lessons
          .filter((l) => l.examSectionId !== undefined)
          .map((l) => l.examSectionId as string)
      ),
    ]

    if (examSectionIds.length > 0) {
      const found = await prisma.examSection.findMany({
        where: { id: { in: examSectionIds } },
        select: { id: true },
      })
      const foundIds = new Set(found.map((s) => s.id))
      for (const esId of examSectionIds) {
        if (!foundIds.has(esId)) {
          return NextResponse.json(
            { error: `Exam section not found: ${esId}` },
            { status: 400 }
          )
        }
      }
    }

    // --- Perform the batch update inside an interactive transaction ---
    const updated = await prisma.$transaction(async (tx) => {
      const results = []

      for (const lesson of lessons) {
        const data: Record<string, unknown> = {}
        if (lesson.title !== undefined) data.title = lesson.title
        if (lesson.subtitle !== undefined) data.subtitle = lesson.subtitle || null
        if (lesson.description !== undefined) data.description = lesson.description || null
        if (lesson.speaker !== undefined) data.speaker = lesson.speaker || null
        if (lesson.scheduledDate !== undefined) data.scheduledDate = new Date(lesson.scheduledDate)
        if (lesson.examSectionId !== undefined) data.examSectionId = lesson.examSectionId
        if (lesson.isExamDay !== undefined) data.isExamDay = lesson.isExamDay
        if (lesson.status !== undefined) data.status = lesson.status
        if (lesson.cancellationReason !== undefined) data.cancellationReason = lesson.cancellationReason || null

        // Update the lesson fields
        const result = await tx.lesson.update({
          where: { id: lesson.id },
          data,
        })

        // Handle resources: delete existing and recreate
        if (lesson.resources !== undefined) {
          await tx.lessonResource.deleteMany({
            where: { lessonId: lesson.id },
          })

          if (lesson.resources.length > 0) {
            await tx.lessonResource.createMany({
              data: lesson.resources.map((r) => ({
                lessonId: lesson.id,
                title: r.title,
                url: r.url,
              })),
            })
          }
        }

        results.push(result)
      }

      return results
    })

    return NextResponse.json({ updated: updated.length })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
