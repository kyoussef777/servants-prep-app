import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canManageCurriculum } from "@/lib/roles"
import { handleApiError } from "@/lib/api-utils"

// POST /api/lessons/[id]/duplicate - Duplicate a lesson with a new scheduled date
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    if (!canManageCurriculum(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { scheduledDate } = body

    if (!scheduledDate) {
      return NextResponse.json(
        { error: "scheduledDate is required" },
        { status: 400 }
      )
    }

    const parsedDate = new Date(scheduledDate)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "scheduledDate is not a valid date" },
        { status: 400 }
      )
    }

    // Fetch the source lesson
    const source = await prisma.lesson.findUnique({
      where: { id },
    })

    if (!source) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    const sourceResources = await prisma.lessonResource.findMany({
      where: { lessonId: id },
      orderBy: { createdAt: "asc" },
    })

    // Wrap in transaction to avoid race condition on lessonNumber
    const duplicate = await prisma.$transaction(async (tx) => {
      const maxResult = await tx.lesson.aggregate({
        where: { academicYearId: source.academicYearId },
        _max: { lessonNumber: true },
      })
      const nextLessonNumber = (maxResult._max.lessonNumber ?? 0) + 1

      const createData: Record<string, unknown> = {
        academicYearId: source.academicYearId,
        examSectionId: source.examSectionId,
        title: source.title,
        subtitle: source.subtitle,
        description: source.description,
        isExamDay: source.isExamDay,
        scheduledDate: parsedDate,
        lessonNumber: nextLessonNumber,
        status: "SCHEDULED",
        createdBy: user.id,
      }

      // Copy speaker if present on the source record
      if ("speaker" in source) {
        createData.speaker = (source as Record<string, unknown>).speaker
      }

      // Copy resources
      if (sourceResources.length > 0) {
        createData.resources = {
          create: sourceResources.map((r) => ({
            title: r.title,
            url: r.url,
            type: r.type,
          })),
        }
      }

      return tx.lesson.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: createData as any,
        include: {
          examSection: true,
          academicYear: {
            select: {
              id: true,
              name: true,
            },
          },
          resources: {
            orderBy: { createdAt: "asc" },
          },
          _count: {
            select: {
              attendanceRecords: true,
            },
          },
        },
      })
    })

    return NextResponse.json(duplicate, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
