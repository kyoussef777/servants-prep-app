import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canViewStudents } from "@/lib/roles"
import { UserRole } from "@prisma/client"

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
    // Only count lessons that have attendance records (i.e., attendance was taken)
    const lessonFilter = academicYearId
      ? { academicYearId }
      : {}

    // Filter for lessons with attendance records
    const lessonsWithAttendanceFilter = {
      ...lessonFilter,
      attendanceRecords: { some: {} }
    }

    // Build exam filter - if academicYearId provided, filter by it; otherwise include all
    const examFilter = academicYearId
      ? { exam: { academicYearId } }
      : {}

    // Get academic years for reference
    const academicYears = await prisma.academicYear.findMany({
      orderBy: { startDate: 'asc' },
      select: { id: true, name: true }
    })

    // Create academic year ID lookup by name
    const academicYearIdByName = new Map<string, string>()
    academicYears.forEach(ay => {
      if (ay.name.includes('2024-2025')) {
        academicYearIdByName.set('2024-2025', ay.id)
      } else if (ay.name.includes('2025-2026')) {
        academicYearIdByName.set('2025-2026', ay.id)
      }
    })

    // Year mapping is now PER-STUDENT based on their current year level:
    // - Year 2 students: Year 1 = 2024-2025, Year 2 = 2025-2026
    // - Year 1 students: Year 1 = 2025-2026, Year 2 = N/A (not started yet)
    // We'll create a function to get the year mapping for each student
    const getStudentYearMapping = (studentYearLevel: string) => {
      if (studentYearLevel === 'YEAR_2') {
        // Year 2 students started in 2024-2025
        return {
          year1AcademicYearId: academicYearIdByName.get('2024-2025'),
          year2AcademicYearId: academicYearIdByName.get('2025-2026')
        }
      } else {
        // Year 1 students started in 2025-2026
        return {
          year1AcademicYearId: academicYearIdByName.get('2025-2026'),
          year2AcademicYearId: null // Not in Year 2 yet
        }
      }
    }

    // Run all queries in parallel for better performance
    const [lessonsWithAttendanceCount, attendanceAggregates, examAggregates, examScoresWithSections, attendanceWithYear] = await Promise.all([
      // Count only lessons that have attendance records (completed lessons with attendance taken)
      prisma.lesson.count({
        where: lessonsWithAttendanceFilter
      }),

      // Get attendance counts grouped by student and status
      // Much more efficient than fetching all records and filtering in JS
      prisma.attendanceRecord.groupBy({
        by: ['studentId', 'status'],
        where: {
          studentId: { in: studentIds },
          lesson: lessonsWithAttendanceFilter
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
          lesson: lessonsWithAttendanceFilter
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

    // Build attendance by student by academic year (raw data, will be mapped per-student later)
    const attendanceByStudentByAcademicYear = new Map<string, Map<string, { present: number; late: number; absent: number }>>()
    for (const record of attendanceWithYear) {
      if (!attendanceByStudentByAcademicYear.has(record.studentId)) {
        attendanceByStudentByAcademicYear.set(record.studentId, new Map())
      }
      const studentYearMap = attendanceByStudentByAcademicYear.get(record.studentId)!
      const academicYearId = record.lesson.academicYearId

      if (!studentYearMap.has(academicYearId)) {
        studentYearMap.set(academicYearId, { present: 0, late: 0, absent: 0 })
      }
      const yearRecord = studentYearMap.get(academicYearId)!

      if (record.status === 'PRESENT') yearRecord.present++
      else if (record.status === 'LATE') yearRecord.late++
      else if (record.status === 'ABSENT') yearRecord.absent++
    }

    // Count lessons per academic year (only lessons with attendance records)
    const lessonsByAcademicYear = await prisma.lesson.groupBy({
      by: ['academicYearId'],
      where: lessonsWithAttendanceFilter,
      _count: true
    })

    const lessonsCountByAcademicYear = new Map<string, number>()
    for (const l of lessonsByAcademicYear) {
      lessonsCountByAcademicYear.set(l.academicYearId, l._count)
    }

    // Calculate stats for each student using pre-aggregated data
    const studentAnalytics = enrollments.map(enrollment => {
      const studentId = enrollment.studentId
      const attendance = attendanceByStudent.get(studentId) || { present: 0, late: 0, absent: 0 }
      const exams = examsByStudent.get(studentId) || { avg: 0, count: 0 }

      // Get per-student year mapping based on their current year level
      const studentYearMapping = getStudentYearMapping(enrollment.yearLevel)
      const studentAcademicYearAttendance = attendanceByStudentByAcademicYear.get(studentId)

      // Get Year 1 attendance for this student
      const year1AcademicYearId = studentYearMapping.year1AcademicYearId
      const year1Attendance = year1AcademicYearId && studentAcademicYearAttendance
        ? studentAcademicYearAttendance.get(year1AcademicYearId) || { present: 0, late: 0, absent: 0 }
        : { present: 0, late: 0, absent: 0 }
      const year1LessonsCount = year1AcademicYearId
        ? lessonsCountByAcademicYear.get(year1AcademicYearId) || 0
        : 0

      // Get Year 2 attendance for this student (null if not in Year 2 yet)
      const year2AcademicYearId = studentYearMapping.year2AcademicYearId
      const year2Attendance = year2AcademicYearId && studentAcademicYearAttendance
        ? studentAcademicYearAttendance.get(year2AcademicYearId) || { present: 0, late: 0, absent: 0 }
        : null // null means not in Year 2 yet
      const year2LessonsCount = year2AcademicYearId
        ? lessonsCountByAcademicYear.get(year2AcademicYearId) || 0
        : 0

      // Calculate attendance using Formula A: (Present + Late/2) / Total * 100
      const presentCount = attendance.present
      const lateCount = attendance.late
      const absentCount = attendance.absent

      // Overall attendance calculation (only count lessons where attendance was taken)
      const totalEffectivePresent = presentCount + (lateCount / 2)
      const overallAttendancePercentage = lessonsWithAttendanceCount > 0
        ? (totalEffectivePresent / lessonsWithAttendanceCount) * 100
        : 0

      // Year 1 attendance
      const year1EffectivePresent = year1Attendance.present + (year1Attendance.late / 2)
      const year1AttendancePercentage = year1LessonsCount > 0
        ? (year1EffectivePresent / year1LessonsCount) * 100
        : 0

      // Year 2 attendance (null if student is still in Year 1)
      const year2EffectivePresent = year2Attendance
        ? year2Attendance.present + (year2Attendance.late / 2)
        : 0
      const year2AttendancePercentage = year2Attendance && year2LessonsCount > 0
        ? (year2EffectivePresent / year2LessonsCount) * 100
        : null // null indicates not applicable (Year 1 student)

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
        totalLessons: lessonsWithAttendanceCount,
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
        // Year-based (for admin page) - based on student's enrollment year
        // Year 1 students: Year 1 = current year, Year 2 = null (not started)
        // Year 2 students: Year 1 = last year, Year 2 = current year
        year1AttendancePercentage: Math.round(year1AttendancePercentage * 10) / 10,
        year2AttendancePercentage: year2AttendancePercentage !== null
          ? Math.round(year2AttendancePercentage * 10) / 10
          : null,
        year1TotalLessons: year1LessonsCount,
        year2TotalLessons: year2AcademicYearId ? year2LessonsCount : null,
        year1AttendedLessons: Math.round(year1EffectivePresent * 10) / 10,
        year2AttendedLessons: year2Attendance !== null
          ? Math.round(year2EffectivePresent * 10) / 10
          : null
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
