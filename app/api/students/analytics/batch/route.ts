import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/roles"

// GET /api/students/analytics/batch - Get analytics for all students efficiently
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    // Only admins can view batch analytics
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

    // Get all active enrollments
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        isActive: true
      },
      include: {
        student: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Get all lessons for this academic year grouped by year level
    const allLessons = await prisma.lesson.findMany({
      where: {
        academicYearId,
        status: {
          in: ['SCHEDULED', 'COMPLETED']
        }
      },
      include: {
        examSection: true
      }
    })

    // Get all attendance records for this academic year
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        lesson: {
          academicYearId,
          status: {
            in: ['SCHEDULED', 'COMPLETED']
          }
        }
      },
      include: {
        lesson: {
          include: {
            examSection: true
          }
        }
      }
    })

    // Get all exam scores for this academic year
    const examScores = await prisma.examScore.findMany({
      where: {
        exam: {
          academicYearId
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

    // Calculate stats for each student
    const studentAnalytics = enrollments.map(enrollment => {
      const studentId = enrollment.studentId
      const studentAttendance = attendanceRecords.filter(r => r.studentId === studentId)

      // Calculate attendance based on student's current year level
      // Start at 100% and deduct for absences (late = 0.5 absence)
      const isYear1Student = enrollment.yearLevel === 'YEAR_1'
      const isYear2Student = enrollment.yearLevel === 'YEAR_2'

      // Year 1 attendance calculation
      const year1Absent = isYear1Student ? studentAttendance.filter(r => r.status === 'ABSENT').length : 0
      const year1Late = isYear1Student ? studentAttendance.filter(r => r.status === 'LATE').length : 0
      const year1EffectiveAbsent = year1Absent + (year1Late / 2)
      const year1AttendancePercentage = isYear1Student && allLessons.length > 0
        ? Math.max(0, 100 - (year1EffectiveAbsent / allLessons.length) * 100)
        : 100

      // Year 2 attendance calculation
      const year2Absent = isYear2Student ? studentAttendance.filter(r => r.status === 'ABSENT').length : 0
      const year2Late = isYear2Student ? studentAttendance.filter(r => r.status === 'LATE').length : 0
      const year2EffectiveAbsent = year2Absent + (year2Late / 2)
      const year2AttendancePercentage = isYear2Student && allLessons.length > 0
        ? Math.max(0, 100 - (year2EffectiveAbsent / allLessons.length) * 100)
        : 100

      // Calculate overall attendance
      const totalAbsent = studentAttendance.filter(r => r.status === 'ABSENT').length
      const totalLate = studentAttendance.filter(r => r.status === 'LATE').length
      const totalEffectiveAbsent = totalAbsent + (totalLate / 2)
      const overallAttendancePercentage = allLessons.length > 0
        ? Math.max(0, 100 - (totalEffectiveAbsent / allLessons.length) * 100)
        : 100

      // Calculate effective present for display purposes
      const totalPresent = studentAttendance.filter(r => r.status === 'PRESENT').length
      const totalEffectivePresent = totalPresent + (totalLate / 2)
      const year1Present = isYear1Student ? studentAttendance.filter(r => r.status === 'PRESENT').length : 0
      const year1EffectivePresent = year1Present + (year1Late / 2)
      const year2Present = isYear2Student ? studentAttendance.filter(r => r.status === 'PRESENT').length : 0
      const year2EffectivePresent = year2Present + (year2Late / 2)

      // Calculate exam average
      const studentExamScores = examScores.filter(s => s.studentId === studentId)
      const avgExamScore = studentExamScores.length > 0
        ? studentExamScores.reduce((sum, s) => sum + s.percentage, 0) / studentExamScores.length
        : 0

      return {
        studentId,
        studentName: enrollment.student.name,
        yearLevel: enrollment.yearLevel,
        attendancePercentage: Math.round(overallAttendancePercentage * 10) / 10,
        year1AttendancePercentage: Math.round(year1AttendancePercentage * 10) / 10,
        year2AttendancePercentage: Math.round(year2AttendancePercentage * 10) / 10,
        avgExamScore: Math.round(avgExamScore * 10) / 10,
        totalLessons: allLessons.length,
        year1TotalLessons: isYear1Student ? allLessons.length : 0,
        year2TotalLessons: isYear2Student ? allLessons.length : 0,
        attendedLessons: Math.round(totalEffectivePresent * 10) / 10,
        year1AttendedLessons: Math.round(year1EffectivePresent * 10) / 10,
        year2AttendedLessons: Math.round(year2EffectivePresent * 10) / 10,
        examCount: studentExamScores.length
      }
    })

    return NextResponse.json(studentAnalytics)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch batch analytics" },
      { status: 500 }
    )
  }
}
