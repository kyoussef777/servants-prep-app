import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { UserRole } from "@prisma/client"
import { isAdmin } from "@/lib/roles"

// GET /api/attendance - List attendance records (Admins see all, Mentors see only their mentees)
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const lessonId = searchParams.get('lessonId')
    const studentId = searchParams.get('studentId')

    const where: any = {}
    if (lessonId) where.lessonId = lessonId
    if (studentId) where.studentId = studentId

    // If MENTOR role, restrict to only their mentees
    if (user.role === UserRole.MENTOR) {
      where.student = {
        enrollments: {
          some: {
            mentorId: user.id
          }
        }
      }
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        lesson: {
          select: {
            id: true,
            title: true,
            scheduledDate: true,
            lessonNumber: true,
          }
        },
        recorder: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        recordedAt: 'desc'
      }
    })

    return NextResponse.json(records)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch attendance records" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}

// POST /api/attendance - Create attendance record (Admin only)
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
    const { lessonId, studentId, status, arrivedAt, notes } = body

    if (!lessonId || !studentId || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if record already exists
    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        lessonId_studentId: {
          lessonId,
          studentId
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Attendance record already exists for this student and lesson" },
        { status: 400 }
      )
    }

    const record = await prisma.attendanceRecord.create({
      data: {
        lessonId,
        studentId,
        status,
        arrivedAt: arrivedAt ? new Date(arrivedAt) : null,
        notes,
        recordedBy: user.id,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create attendance record" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}
