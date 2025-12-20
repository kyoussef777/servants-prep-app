import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/roles"

// GET /api/students/[id]/details - Get detailed student data for editing
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: studentId } = await params

    // Only admins can view detailed student data
    if (!isAdmin(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const academicYearId = searchParams.get('academicYearId')

    if (!academicYearId) {
      return NextResponse.json(
        { error: "Academic year ID is required" },
        { status: 400 }
      )
    }

    // Get student with enrollment
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          include: {
            mentor: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      )
    }

    // Get all exam scores with exam and section details
    const examScores = await prisma.examScore.findMany({
      where: {
        studentId,
        exam: {
          academicYearId
        }
      },
      include: {
        exam: {
          include: {
            examSection: true
          }
        },
        grader: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        gradedAt: 'desc'
      }
    })

    // Get all attendance records with lesson details
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        studentId,
        lesson: {
          academicYearId
        }
      },
      include: {
        lesson: {
          include: {
            examSection: true
          }
        },
        recorder: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        lesson: {
          scheduledDate: 'desc'
        }
      }
    })

    // Get all exams for this academic year (to show missing scores)
    // Limited to recent 6 months for performance
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const allExams = await prisma.exam.findMany({
      where: {
        academicYearId,
        yearLevel: {
          in: student.enrollments?.[0]?.yearLevel ?
            ['BOTH', student.enrollments[0].yearLevel] :
            ['BOTH']
        },
        examDate: {
          gte: sixMonthsAgo
        }
      },
      include: {
        examSection: true
      },
      orderBy: {
        examDate: 'desc'
      },
      take: 50 // Limit to 50 most recent exams
    })

    // Get all lessons for this academic year (to show missing attendance)
    // Limited to recent 6 months for performance
    const allLessons = await prisma.lesson.findMany({
      where: {
        academicYearId,
        status: {
          in: ['SCHEDULED', 'COMPLETED']
        },
        scheduledDate: {
          gte: sixMonthsAgo
        }
      },
      include: {
        examSection: true
      },
      orderBy: {
        scheduledDate: 'desc'
      },
      take: 100 // Limit to 100 most recent lessons
    })

    return NextResponse.json({
      student,
      examScores,
      attendanceRecords,
      allExams,
      allLessons
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch student details" },
      { status: 500 }
    )
  }
}
