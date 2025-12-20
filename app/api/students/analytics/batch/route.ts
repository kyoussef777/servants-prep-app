import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/roles"

// GET /api/students/analytics/batch - Get analytics for all students efficiently
// OPTIMIZED: Uses database aggregations instead of fetching all records
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

    // Get all active enrollments with student IDs (minimal data)
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        isActive: true
      },
      select: {
        studentId: true,
        yearLevel: true,
        student: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    const studentIds = enrollments.map(e => e.studentId)

    // Run all queries in parallel for better performance
    const [totalLessonsCount, attendanceAggregates, examAggregates] = await Promise.all([
      // Count lessons (don't fetch all lesson data, just count)
      prisma.lesson.count({
        where: {
          academicYearId,
          status: { in: ['SCHEDULED', 'COMPLETED'] }
        }
      }),

      // Get attendance counts grouped by student and status
      // Much more efficient than fetching all records and filtering in JS
      prisma.attendanceRecord.groupBy({
        by: ['studentId', 'status'],
        where: {
          studentId: { in: studentIds },
          lesson: {
            academicYearId,
            status: { in: ['SCHEDULED', 'COMPLETED'] }
          }
        },
        _count: { status: true }
      }),

      // Get exam score averages per student using DB aggregation
      prisma.examScore.groupBy({
        by: ['studentId'],
        where: {
          studentId: { in: studentIds },
          exam: { academicYearId }
        },
        _avg: { percentage: true },
        _count: { id: true }
      })
    ])

    // Build lookup maps for O(1) access
    const attendanceByStudent = new Map<string, { present: number; late: number; absent: number }>()
    for (const agg of attendanceAggregates) {
      if (!attendanceByStudent.has(agg.studentId)) {
        attendanceByStudent.set(agg.studentId, { present: 0, late: 0, absent: 0 })
      }
      const record = attendanceByStudent.get(agg.studentId)!
      if (agg.status === 'PRESENT') record.present = agg._count.status
      else if (agg.status === 'LATE') record.late = agg._count.status
      else if (agg.status === 'ABSENT') record.absent = agg._count.status
    }

    const examsByStudent = new Map<string, { avg: number; count: number }>()
    for (const agg of examAggregates) {
      examsByStudent.set(agg.studentId, {
        avg: agg._avg.percentage || 0,
        count: agg._count.id
      })
    }

    // Calculate stats for each student using pre-aggregated data
    const studentAnalytics = enrollments.map(enrollment => {
      const studentId = enrollment.studentId
      const attendance = attendanceByStudent.get(studentId) || { present: 0, late: 0, absent: 0 }
      const exams = examsByStudent.get(studentId) || { avg: 0, count: 0 }

      // Calculate attendance using Formula A: (Present + Late/2) / Total * 100
      const isYear1Student = enrollment.yearLevel === 'YEAR_1'
      const isYear2Student = enrollment.yearLevel === 'YEAR_2'

      const totalPresent = attendance.present
      const totalLate = attendance.late

      // Overall attendance calculation
      const totalEffectivePresent = totalPresent + (totalLate / 2)
      const overallAttendancePercentage = totalLessonsCount > 0
        ? (totalEffectivePresent / totalLessonsCount) * 100
        : 0

      // Year-based attendance (simplified - current year only)
      const year1EffectivePresent = isYear1Student ? totalEffectivePresent : 0
      const year1AttendancePercentage = isYear1Student && totalLessonsCount > 0
        ? (year1EffectivePresent / totalLessonsCount) * 100
        : 0

      const year2EffectivePresent = isYear2Student ? totalEffectivePresent : 0
      const year2AttendancePercentage = isYear2Student && totalLessonsCount > 0
        ? (year2EffectivePresent / totalLessonsCount) * 100
        : 0

      return {
        studentId,
        studentName: enrollment.student.name,
        yearLevel: enrollment.yearLevel,
        attendancePercentage: Math.round(overallAttendancePercentage * 10) / 10,
        year1AttendancePercentage: Math.round(year1AttendancePercentage * 10) / 10,
        year2AttendancePercentage: Math.round(year2AttendancePercentage * 10) / 10,
        avgExamScore: Math.round(exams.avg * 10) / 10,
        totalLessons: totalLessonsCount,
        year1TotalLessons: isYear1Student ? totalLessonsCount : 0,
        year2TotalLessons: isYear2Student ? totalLessonsCount : 0,
        attendedLessons: Math.round(totalEffectivePresent * 10) / 10,
        year1AttendedLessons: Math.round(year1EffectivePresent * 10) / 10,
        year2AttendedLessons: Math.round(year2EffectivePresent * 10) / 10,
        examCount: exams.count
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
