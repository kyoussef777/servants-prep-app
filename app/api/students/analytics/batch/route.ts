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

    // Get academic years to map to program years (Year 1 vs Year 2)
    // Academic years are ordered by start date - first year of program = Year 1, second = Year 2
    const academicYears = await prisma.academicYear.findMany({
      orderBy: { startDate: 'asc' },
      select: { id: true, name: true }
    })

    // Create mapping: academic year ID -> program year (1 or 2)
    // 2024-2025 = Year 1 curriculum, 2025-2026 = Year 2 curriculum
    const yearMapping = new Map<string, number>()
    academicYears.forEach((ay, index) => {
      // Skip 2023-2024 (index 0), 2024-2025 (index 1) = Year 1, 2025-2026 (index 2) = Year 2
      if (ay.name.includes('2024-2025')) {
        yearMapping.set(ay.id, 1)
      } else if (ay.name.includes('2025-2026')) {
        yearMapping.set(ay.id, 2)
      }
    })

    // Run all queries in parallel for better performance
    const [totalLessonsCount, attendanceAggregates, examAggregates, examScoresWithSections, attendanceWithYear] = await Promise.all([
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
      }),

      // Get attendance with academic year info for year-based breakdown
      prisma.attendanceRecord.findMany({
        where: {
          studentId: { in: studentIds },
          lesson: lessonFilter
        },
        select: {
          studentId: true,
          status: true,
          lesson: {
            select: {
              academicYearId: true
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

    // Build year-based attendance by student (based on academic year, not student's current year level)
    // Year 1 = 2024-2025 academic year lessons, Year 2 = 2025-2026 academic year lessons
    const attendanceByStudentByYear = new Map<string, { year1: { present: number; late: number; absent: number }; year2: { present: number; late: number; absent: number } }>()
    for (const record of attendanceWithYear) {
      if (!attendanceByStudentByYear.has(record.studentId)) {
        attendanceByStudentByYear.set(record.studentId, {
          year1: { present: 0, late: 0, absent: 0 },
          year2: { present: 0, late: 0, absent: 0 }
        })
      }
      const studentRecord = attendanceByStudentByYear.get(record.studentId)!
      const programYear = yearMapping.get(record.lesson.academicYearId) || 0

      if (programYear === 1) {
        if (record.status === 'PRESENT') studentRecord.year1.present++
        else if (record.status === 'LATE') studentRecord.year1.late++
        else if (record.status === 'ABSENT') studentRecord.year1.absent++
      } else if (programYear === 2) {
        if (record.status === 'PRESENT') studentRecord.year2.present++
        else if (record.status === 'LATE') studentRecord.year2.late++
        else if (record.status === 'ABSENT') studentRecord.year2.absent++
      }
    }

    // Count lessons per program year
    const lessonsByYear = await prisma.lesson.groupBy({
      by: ['academicYearId'],
      where: lessonFilter,
      _count: true
    })

    let year1LessonsCount = 0
    let year2LessonsCount = 0
    for (const l of lessonsByYear) {
      const programYear = yearMapping.get(l.academicYearId)
      if (programYear === 1) year1LessonsCount = l._count
      else if (programYear === 2) year2LessonsCount = l._count
    }

    // Calculate stats for each student using pre-aggregated data
    const studentAnalytics = enrollments.map(enrollment => {
      const studentId = enrollment.studentId
      const attendance = attendanceByStudent.get(studentId) || { present: 0, late: 0, absent: 0 }
      const exams = examsByStudent.get(studentId) || { avg: 0, count: 0 }
      const yearAttendance = attendanceByStudentByYear.get(studentId) || {
        year1: { present: 0, late: 0, absent: 0 },
        year2: { present: 0, late: 0, absent: 0 }
      }

      // Calculate attendance using Formula A: (Present + Late/2) / Total * 100
      const presentCount = attendance.present
      const lateCount = attendance.late
      const absentCount = attendance.absent

      // Overall attendance calculation
      const totalEffectivePresent = presentCount + (lateCount / 2)
      const overallAttendancePercentage = totalLessonsCount > 0
        ? (totalEffectivePresent / totalLessonsCount) * 100
        : 0

      // Year-based attendance (based on academic year, not student's current year level)
      // Year 1 attendance = attendance in 2024-2025 lessons
      // Year 2 attendance = attendance in 2025-2026 lessons
      const year1EffectivePresent = yearAttendance.year1.present + (yearAttendance.year1.late / 2)
      const year1AttendancePercentage = year1LessonsCount > 0
        ? (year1EffectivePresent / year1LessonsCount) * 100
        : 0

      const year2EffectivePresent = yearAttendance.year2.present + (yearAttendance.year2.late / 2)
      const year2AttendancePercentage = year2LessonsCount > 0
        ? (year2EffectivePresent / year2LessonsCount) * 100
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
        // Year-based (for admin page) - based on academic year, not student's current year level
        year1AttendancePercentage: Math.round(year1AttendancePercentage * 10) / 10,
        year2AttendancePercentage: Math.round(year2AttendancePercentage * 10) / 10,
        year1TotalLessons: year1LessonsCount,
        year2TotalLessons: year2LessonsCount,
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
