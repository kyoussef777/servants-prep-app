import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canManageCurriculum } from "@/lib/roles"


// GET /api/lessons - List lessons
// Query params:
//   ?academicYearId=xxx - filter by academic year
//   ?examSectionId=xxx - filter by exam section
//   ?status=COMPLETED - filter by status
//   ?page=1&limit=50 - pagination (default: all results for backwards compatibility)
export async function GET(request: Request) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const academicYearId = searchParams.get('academicYearId')
    const examSectionId = searchParams.get('examSectionId')
    const status = searchParams.get('status')
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : null
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50

    const where: Record<string, unknown> = {}
    if (academicYearId) where.academicYearId = academicYearId
    if (examSectionId) where.examSectionId = examSectionId
    if (status) where.status = status

    const queryOptions: {
      where: Record<string, unknown>
      include: Record<string, unknown>
      orderBy: { scheduledDate: 'asc' }
      skip?: number
      take?: number
    } = {
      where,
      include: {
        examSection: true,
        academicYear: {
          select: {
            id: true,
            name: true,
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
          }
        },
        resources: {
          orderBy: {
            createdAt: 'asc'
          }
        },
        _count: {
          select: {
            attendanceRecords: {
              where: {
                status: { in: ['PRESENT', 'LATE'] }
              }
            }
          }
        }
      },
      orderBy: {
        scheduledDate: 'asc'
      }
    }

    // Add pagination if requested
    if (page !== null) {
      queryOptions.skip = (page - 1) * limit
      queryOptions.take = limit

      const [lessons, total] = await Promise.all([
        prisma.lesson.findMany(queryOptions),
        prisma.lesson.count({ where })
      ])

      return NextResponse.json({
        data: lessons,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })
    }

    // No pagination - return all (backwards compatible)
    const lessons = await prisma.lesson.findMany(queryOptions)

    // Auto-complete lessons that have passed their scheduled date
    const now = new Date()
    const lessonsToComplete = lessons.filter(
      lesson => lesson.status === 'SCHEDULED' && new Date(lesson.scheduledDate) < now
    )

    if (lessonsToComplete.length > 0) {
      // Use updateMany for efficient batch update (single query instead of N queries)
      await prisma.lesson.updateMany({
        where: {
          id: { in: lessonsToComplete.map(lesson => lesson.id) }
        },
        data: { status: 'COMPLETED' }
      })

      // Update the lessons array to reflect the new status
      lessonsToComplete.forEach(lesson => {
        lesson.status = 'COMPLETED'
      })
    }

    return NextResponse.json(lessons)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch lessons" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}

// POST /api/lessons - Create a new lesson (SUPER_ADMIN and SERVANT_PREP only, PRIEST is read-only)
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    // PRIEST is read-only, only SUPER_ADMIN and SERVANT_PREP can manage curriculum
    if (!canManageCurriculum(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { academicYearId, examSectionId, title, subtitle, description, scheduledDate, lessonNumber, resources, isExamDay } = body

    if (!academicYearId || !examSectionId || !title || !scheduledDate || !lessonNumber) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const lesson = await prisma.lesson.create({
      data: {
        academicYearId,
        examSectionId,
        title,
        subtitle: subtitle || null,
        description: description || null,
        scheduledDate: new Date(scheduledDate),
        lessonNumber,
        isExamDay: isExamDay || false,
        createdBy: user.id,
        resources: resources && resources.length > 0 ? {
          create: resources.map((r: { title: string; url: string; type?: string }) => ({
            title: r.title,
            url: r.url,
            type: r.type || null,
          }))
        } : undefined,
      },
      include: {
        examSection: true,
        creator: {
          select: {
            id: true,
            name: true,
          }
        },
        resources: {
          orderBy: {
            createdAt: 'asc'
          }
        },
        _count: {
          select: {
            attendanceRecords: {
              where: {
                status: { in: ['PRESENT', 'LATE'] }
              }
            }
          }
        }
      }
    })

    return NextResponse.json(lesson, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create lesson" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}
