import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin, canViewStudents } from "@/lib/roles"
import { LessonStatus, UserRole } from "@prisma/client"

// GET /api/students/analytics/batch - Get analytics for all students efficiently
// OPTIMIZED: Uses database aggregations instead of fetching all records
// NOTE: academicYearId parameter is optional. If not provided, aggregates across ALL academic years.
// Supports studentIds parameter to filter to specific students (used by mentors)
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    // Admins and mentors can view analytics (mentors only for their assigned students)
    if (!canViewStudents(user.role as UserRole)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const academicYearId = searchParams.get('academicYearId')
    const studentIdsParam = searchParams.get('studentIds')

    // academicYearId is now optional - if not provided, aggregate across all years

    // Build enrollment filter - if studentIds provided, filter to those; otherwise get all active
    const enrollmentFilter: { isActive: boolean; studentId?: { in: string[] } } = {
      isActive: true
    }

    if (studentIdsParam) {
      const requestedStudentIds = studentIdsParam.split(',').filter(id => id.trim())
      if (requestedStudentIds.length > 0) {
        enrollmentFilter.studentId = { in: requestedStudentIds }
      }
    }

    // Get enrollments with student IDs (minimal data)
    const enrollments = await prisma.studentEnrollment.findMany({
      where: enrollmentFilter,
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

    // Build lesson filter - if academicYearId provided, filter by it; otherwise include all
    const validStatuses: LessonStatus[] = [LessonStatus.SCHEDULED, LessonStatus.COMPLETED]
    const lessonFilter = academicYearId
      ? { academicYearId, status: { in: validStatuses } }
      : { status: { in: validStatuses } }

    // Build exam filter - if academicYearId provided, filter by it; otherwise include all
    const examFilter = academicYearId
      ? { exam: { academicYearId } }
      : {}

    // Run all queries in parallel for better performance
    const [totalLessonsCount, attendanceAggregates, examAggregates, examScoresWithSections] = await Promise.all([
      // Count lessons (don't fetch all lesson data, just count)
      prisma.lesson.count({
        where: lessonFilter
      }),

      // Get attendance counts grouped by student and status
      // Much more efficient than fetching all records and filtering in JS
      prisma.attendanceRecord.groupBy({
        by: ['studentId', 'status'],
        where: {
          studentId: { in: studentIds },
          lesson: lessonFilter
        },
        _count: { status: true }
      }),

      // Get exam score averages per student using DB aggregation
      prisma.examScore.groupBy({
        by: ['studentId'],
        where: {
          studentId: { in: studentIds },
          ...examFilter
        },
        _avg: { percentage: true },
        _count: { id: true }
      }),

      // Get exam scores with section info for section-level averages
      prisma.examScore.findMany({
        where: {
          studentId: { in: studentIds },
          ...examFilter
        },
        select: {
          studentId: true,
          percentage: true,
          exam: {
            select: {
              examSection: {
                select: {
                  name: true
                }
              }
            }
          }
        }
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

    // Build section averages per student
    const sectionScoresByStudent = new Map<string, Map<string, number[]>>()
    for (const score of examScoresWithSections) {
      if (!sectionScoresByStudent.has(score.studentId)) {
        sectionScoresByStudent.set(score.studentId, new Map())
      }
      const studentSections = sectionScoresByStudent.get(score.studentId)!
      const sectionName = score.exam.examSection.name
      if (!studentSections.has(sectionName)) {
        studentSections.set(sectionName, [])
      }
      studentSections.get(sectionName)!.push(score.percentage)
    }

    // Calculate stats for each student using pre-aggregated data
    const studentAnalytics = enrollments.map(enrollment => {
      const studentId = enrollment.studentId
      const attendance = attendanceByStudent.get(studentId) || { present: 0, late: 0, absent: 0 }
      const exams = examsByStudent.get(studentId) || { avg: 0, count: 0 }

      // Calculate attendance using Formula A: (Present + Late/2) / Total * 100
      const isYear1Student = enrollment.yearLevel === 'YEAR_1'
      const isYear2Student = enrollment.yearLevel === 'YEAR_2'

      const presentCount = attendance.present
      const lateCount = attendance.late
      const absentCount = attendance.absent

      // Overall attendance calculation
      const totalEffectivePresent = presentCount + (lateCount / 2)
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

      // Calculate section averages for this student
      const studentSections = sectionScoresByStudent.get(studentId)
      const sectionAverages: { [section: string]: number } = {}
      let allSectionsMet = true

      if (studentSections) {
        for (const [sectionName, scores] of studentSections.entries()) {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length
          sectionAverages[sectionName] = Math.round(avg * 10) / 10
          if (avg < 60) allSectionsMet = false
        }
      }

      // Graduation requirements
      const attendanceMet = overallAttendancePercentage >= 75
      const examAverage = exams.avg
      const examAverageMet = examAverage >= 75
      const graduationEligible = attendanceMet && examAverageMet && allSectionsMet

      return {
        studentId,
        studentName: enrollment.student.name,
        yearLevel: enrollment.yearLevel,
        // Attendance
        attendancePercentage: Math.round(overallAttendancePercentage * 10) / 10,
        attendanceMet,
        totalLessons: totalLessonsCount,
        presentCount,
        lateCount,
        absentCount,
        attendedLessons: Math.round(totalEffectivePresent * 10) / 10,
        // Exams
        examAverage: Math.round(examAverage * 10) / 10,
        avgExamScore: Math.round(exams.avg * 10) / 10,
        examAverageMet,
        examCount: exams.count,
        sectionAverages,
        allSectionsMet,
        // Graduation
        graduationEligible,
        // Year-based (for admin page)
        year1AttendancePercentage: Math.round(year1AttendancePercentage * 10) / 10,
        year2AttendancePercentage: Math.round(year2AttendancePercentage * 10) / 10,
        year1TotalLessons: isYear1Student ? totalLessonsCount : 0,
        year2TotalLessons: isYear2Student ? totalLessonsCount : 0,
        year1AttendedLessons: Math.round(year1EffectivePresent * 10) / 10,
        year2AttendedLessons: Math.round(year2EffectivePresent * 10) / 10
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
