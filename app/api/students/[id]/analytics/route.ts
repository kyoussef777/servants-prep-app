import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"

// GET /api/students/[id]/analytics - Get student analytics including graduation status
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: studentId } = await params

    // Students can only view their own analytics
    if (user.role === 'STUDENT' && user.id !== studentId) {
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

    // Get enrollment
    const enrollment = await prisma.studentEnrollment.findUnique({
      where: {
        studentId
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    })

    if (!enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found" },
        { status: 404 }
      )
    }

    // Get all lessons for this academic year (only SCHEDULED and COMPLETED count)
    const totalLessons = await prisma.lesson.count({
      where: {
        academicYearId,
        status: {
          in: ['SCHEDULED', 'COMPLETED']
        }
      }
    })

    // Get attendance records
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        studentId,
        lesson: {
          academicYearId,
          status: {
            in: ['SCHEDULED', 'COMPLETED']
          }
        }
      },
      include: {
        lesson: true
      }
    })

    // Calculate attendance
    const presentCount = attendanceRecords.filter(r => r.status === 'PRESENT').length
    const lateCount = attendanceRecords.filter(r => r.status === 'LATE').length
    const absentCount = attendanceRecords.filter(r => r.status === 'ABSENT').length

    // Formula: (Present + (Lates / 2)) / TotalScheduledLessons
    const effectivePresent = presentCount + (lateCount / 2)
    const attendancePercentage = totalLessons > 0 ? (effectivePresent / totalLessons) * 100 : 0
    const attendanceMet = attendancePercentage >= 75

    // Get exam scores by section
    const examScores = await prisma.examScore.findMany({
      where: {
        studentId,
        exam: {
          academicYearId,
          yearLevel: {
            in: ['BOTH', enrollment.yearLevel]
          }
        }
      },
      include: {
        exam: {
          include: {
            examSection: true
          }
        }
      }
    })

    // Group scores by section
    const scoresBySection: { [key: string]: number[] } = {}
    examScores.forEach(score => {
      const sectionName = score.exam.examSection.name
      if (!scoresBySection[sectionName]) {
        scoresBySection[sectionName] = []
      }
      scoresBySection[sectionName].push(score.percentage)
    })

    // Calculate averages per section
    const sectionAverages = Object.entries(scoresBySection).map(([section, scores]) => {
      const average = scores.reduce((a, b) => a + b, 0) / scores.length
      return {
        section,
        average,
        scores,
        passingMet: average >= 60
      }
    })

    // Calculate overall average
    const allScores = Object.values(scoresBySection).flat()
    const overallAverage = allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : 0
    const overallAverageMet = overallAverage >= 75

    // Check if all sections have at least 60%
    const allSectionsPassing = sectionAverages.every(s => s.passingMet)

    // Graduation eligibility
    const graduationEligible = attendanceMet && overallAverageMet && allSectionsPassing

    return NextResponse.json({
      enrollment,
      attendance: {
        totalLessons,
        presentCount,
        lateCount,
        absentCount,
        effectivePresent,
        percentage: attendancePercentage,
        met: attendanceMet,
        required: 75
      },
      exams: {
        sectionAverages,
        overallAverage,
        overallAverageMet,
        allSectionsPassing,
        requiredAverage: 75,
        requiredMinimum: 60
      },
      graduation: {
        eligible: graduationEligible,
        attendanceMet,
        overallAverageMet,
        allSectionsPassing
      }
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch student analytics" },
      { status: 500 }
    )
  }
}
