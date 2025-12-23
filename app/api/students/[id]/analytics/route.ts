import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { LessonStatus, ExamYearLevel, UserRole } from "@prisma/client"
import { canViewStudents } from "@/lib/roles"

// GET /api/students/[id]/analytics - Get student analytics including graduation status
// NOTE: academicYearId parameter is optional. If not provided, aggregates across ALL academic years.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: studentId } = await params

    // Students can only view their own analytics
    // Admins and mentors can view any student's analytics (mentor restriction handled elsewhere)
    if (user.role === UserRole.STUDENT && user.id !== studentId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // Non-students must have permission to view students
    if (user.role !== UserRole.STUDENT && !canViewStudents(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const academicYearId = searchParams.get('academicYearId')

    // academicYearId is now optional - if not provided, aggregate across all years

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

    // Build lesson filter - if academicYearId provided, filter by it; otherwise include all
    const validStatuses: LessonStatus[] = [LessonStatus.SCHEDULED, LessonStatus.COMPLETED]
    const lessonFilter = academicYearId
      ? { academicYearId, status: { in: validStatuses } }
      : { status: { in: validStatuses } }

    // Get all lessons (only SCHEDULED and COMPLETED count)
    const totalLessons = await prisma.lesson.count({
      where: lessonFilter
    })

    // Get attendance records - only fetch needed fields for performance
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        studentId,
        lesson: lessonFilter
      },
      select: {
        status: true,
        arrivedAt: true,
        lesson: {
          select: {
            status: true
          }
        }
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

    // Build exam filter - if academicYearId provided, filter by it; otherwise include all
    // Map yearLevel to ExamYearLevel (BOTH is always included, plus the student's current year)
    const validYearLevels: ExamYearLevel[] = [
      ExamYearLevel.BOTH,
      enrollment.yearLevel === 'YEAR_1' ? ExamYearLevel.YEAR_1 : ExamYearLevel.YEAR_2
    ]
    const examWhereClause = academicYearId
      ? {
          studentId,
          exam: {
            academicYearId,
            yearLevel: { in: validYearLevels }
          }
        }
      : {
          studentId,
          exam: {
            yearLevel: { in: validYearLevels }
          }
        }

    // Get exam scores by section
    const examScores = await prisma.examScore.findMany({
      where: examWhereClause,
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
