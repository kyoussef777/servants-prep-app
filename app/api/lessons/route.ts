import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/roles"


// GET /api/lessons - List lessons
export async function GET(request: Request) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const academicYearId = searchParams.get('academicYearId')
    const examSectionId = searchParams.get('examSectionId')
    const status = searchParams.get('status')

    const where: any = {}
    if (academicYearId) where.academicYearId = academicYearId
    if (examSectionId) where.examSectionId = examSectionId
    if (status) where.status = status

    const lessons = await prisma.lesson.findMany({
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
        _count: {
          select: {
            attendanceRecords: true
          }
        }
      },
      orderBy: {
        scheduledDate: 'asc'
      }
    })

    return NextResponse.json(lessons)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch lessons" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}

// POST /api/lessons - Create a new lesson (Priest/Servant)
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    // Check if user has admin access
    if (!isAdmin(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { academicYearId, examSectionId, title, subtitle, description, scheduledDate, lessonNumber } = body

    if (!academicYearId || !examSectionId || !title || !description || !scheduledDate || !lessonNumber) {
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
        description,
        scheduledDate: new Date(scheduledDate),
        lessonNumber,
        createdBy: user.id,
      },
      include: {
        examSection: true,
        creator: {
          select: {
            id: true,
            name: true,
          }
        },
        _count: {
          select: {
            attendanceRecords: true
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
