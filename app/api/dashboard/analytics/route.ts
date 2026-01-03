import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/roles"
import { AttendanceStatus } from "@prisma/client"

// GET /api/dashboard/analytics - Get detailed analytics for the dashboard
export async function GET() {
  try {
    const user = await requireAuth()

    if (!isAdmin(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // Get all academic years
    const academicYears = await prisma.academicYear.findMany({
      orderBy: { startDate: 'desc' },
      select: { id: true, name: true, isActive: true }
    })

    // Get all exam sections
    const examSections = await prisma.examSection.findMany({
      select: { id: true, name: true, displayName: true }
    })

    // Get exam scores with exam and section info
    const examScores = await prisma.examScore.findMany({
      select: {
        score: true,
        exam: {
          select: {
            academicYearId: true,
            examSectionId: true
          }
        }
      }
    })

    // Get attendance records with lesson info
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      select: {
        status: true,
        lesson: {
          select: {
            academicYearId: true
          }
        }
      }
    })

    // Get students at risk (below 75% attendance or exam average)
    const activeEnrollments = await prisma.studentEnrollment.findMany({
      where: { isActive: true },
      select: {
        student: {
          select: {
            id: true,
            name: true
          }
        },
        yearLevel: true
      }
    })

    // Calculate exam averages per section per academic year
    const examAveragesByYearAndSection: Record<string, Record<string, { total: number; count: number }>> = {}

    for (const score of examScores) {
      const yearId = score.exam.academicYearId
      const sectionId = score.exam.examSectionId

      if (!examAveragesByYearAndSection[yearId]) {
        examAveragesByYearAndSection[yearId] = {}
      }
      if (!examAveragesByYearAndSection[yearId][sectionId]) {
        examAveragesByYearAndSection[yearId][sectionId] = { total: 0, count: 0 }
      }

      examAveragesByYearAndSection[yearId][sectionId].total += score.score
      examAveragesByYearAndSection[yearId][sectionId].count += 1
    }

    // Calculate attendance stats per academic year
    const attendanceByYear: Record<string, { present: number; late: number; absent: number; excused: number; total: number }> = {}

    for (const record of attendanceRecords) {
      const yearId = record.lesson.academicYearId

      if (!attendanceByYear[yearId]) {
        attendanceByYear[yearId] = { present: 0, late: 0, absent: 0, excused: 0, total: 0 }
      }

      attendanceByYear[yearId].total += 1
      if (record.status === AttendanceStatus.PRESENT) {
        attendanceByYear[yearId].present += 1
      } else if (record.status === AttendanceStatus.LATE) {
        attendanceByYear[yearId].late += 1
      } else if (record.status === AttendanceStatus.ABSENT) {
        attendanceByYear[yearId].absent += 1
      } else if (record.status === AttendanceStatus.EXCUSED) {
        attendanceByYear[yearId].excused += 1
      }
    }

    // Get individual student analytics for at-risk calculation
    const studentIds = activeEnrollments.map(e => e.student.id)

    // Get attendance per student
    const studentAttendance = await prisma.attendanceRecord.groupBy({
      by: ['studentId', 'status'],
      where: {
        studentId: { in: studentIds }
      },
      _count: true
    })

    // Get exam scores per student
    const studentExamScores = await prisma.examScore.findMany({
      where: {
        studentId: { in: studentIds }
      },
      select: {
        studentId: true,
        score: true
      }
    })

    // Calculate at-risk students
    const studentAttendanceMap: Record<string, { present: number; late: number; absent: number; excused: number; total: number }> = {}

    for (const record of studentAttendance) {
      if (!studentAttendanceMap[record.studentId]) {
        studentAttendanceMap[record.studentId] = { present: 0, late: 0, absent: 0, excused: 0, total: 0 }
      }

      studentAttendanceMap[record.studentId].total += record._count
      if (record.status === AttendanceStatus.PRESENT) {
        studentAttendanceMap[record.studentId].present += record._count
      } else if (record.status === AttendanceStatus.LATE) {
        studentAttendanceMap[record.studentId].late += record._count
      } else if (record.status === AttendanceStatus.ABSENT) {
        studentAttendanceMap[record.studentId].absent += record._count
      } else if (record.status === AttendanceStatus.EXCUSED) {
        studentAttendanceMap[record.studentId].excused += record._count
      }
    }

    const studentExamScoresMap: Record<string, number[]> = {}
    for (const score of studentExamScores) {
      if (!studentExamScoresMap[score.studentId]) {
        studentExamScoresMap[score.studentId] = []
      }
      studentExamScoresMap[score.studentId].push(score.score)
    }

    // Identify at-risk students
    const atRiskStudents: Array<{
      id: string
      name: string
      yearLevel: string
      attendanceRate: number | null
      examAverage: number | null
      issues: string[]
    }> = []

    for (const enrollment of activeEnrollments) {
      const studentId = enrollment.student.id
      const attendance = studentAttendanceMap[studentId]
      const scores = studentExamScoresMap[studentId] || []

      let attendanceRate: number | null = null
      let examAverage: number | null = null
      const issues: string[] = []

      if (attendance && attendance.total > 0) {
        const countableLessons = attendance.total - attendance.excused
        if (countableLessons > 0) {
          attendanceRate = ((attendance.present + (attendance.late / 2)) / countableLessons) * 100
          if (attendanceRate < 75) {
            issues.push(`Low attendance: ${attendanceRate.toFixed(1)}%`)
          }
        }
      }

      if (scores.length > 0) {
        examAverage = scores.reduce((a, b) => a + b, 0) / scores.length
        if (examAverage < 75) {
          issues.push(`Low exam average: ${examAverage.toFixed(1)}%`)
        }
      }

      if (issues.length > 0) {
        atRiskStudents.push({
          id: studentId,
          name: enrollment.student.name,
          yearLevel: enrollment.yearLevel,
          attendanceRate,
          examAverage,
          issues
        })
      }
    }

    // Sort at-risk students by severity (more issues first, then by lowest scores)
    atRiskStudents.sort((a, b) => {
      if (b.issues.length !== a.issues.length) {
        return b.issues.length - a.issues.length
      }
      const aMin = Math.min(a.attendanceRate ?? 100, a.examAverage ?? 100)
      const bMin = Math.min(b.attendanceRate ?? 100, b.examAverage ?? 100)
      return aMin - bMin
    })

    // Find weakest sections (lowest average scores)
    const sectionAverages: Array<{ sectionId: string; displayName: string; average: number; count: number }> = []

    for (const section of examSections) {
      let totalScore = 0
      let totalCount = 0

      for (const yearId in examAveragesByYearAndSection) {
        const sectionData = examAveragesByYearAndSection[yearId][section.id]
        if (sectionData) {
          totalScore += sectionData.total
          totalCount += sectionData.count
        }
      }

      if (totalCount > 0) {
        sectionAverages.push({
          sectionId: section.id,
          displayName: section.displayName,
          average: totalScore / totalCount,
          count: totalCount
        })
      }
    }

    sectionAverages.sort((a, b) => a.average - b.average)

    // Format response
    const examScoresByYear = academicYears.map(year => {
      const yearData = examAveragesByYearAndSection[year.id] || {}
      const sections = examSections.map(section => {
        const data = yearData[section.id]
        return {
          sectionId: section.id,
          displayName: section.displayName,
          average: data ? data.total / data.count : null,
          count: data?.count || 0
        }
      })

      // Calculate overall average for the year
      let totalScore = 0
      let totalCount = 0
      for (const section of sections) {
        if (section.average !== null) {
          totalScore += section.average * section.count
          totalCount += section.count
        }
      }

      return {
        yearId: year.id,
        yearName: year.name,
        isActive: year.isActive,
        overallAverage: totalCount > 0 ? totalScore / totalCount : null,
        sections
      }
    })

    const attendanceByYearFormatted = academicYears.map(year => {
      const data = attendanceByYear[year.id] || { present: 0, late: 0, absent: 0, excused: 0, total: 0 }
      const countable = data.total - data.excused
      const rate = countable > 0 ? ((data.present + (data.late / 2)) / countable) * 100 : null

      return {
        yearId: year.id,
        yearName: year.name,
        isActive: year.isActive,
        present: data.present,
        late: data.late,
        absent: data.absent,
        excused: data.excused,
        total: data.total,
        attendanceRate: rate
      }
    })

    return NextResponse.json({
      examScoresByYear,
      attendanceByYear: attendanceByYearFormatted,
      atRiskStudents: atRiskStudents.slice(0, 10), // Top 10 at-risk
      weakestSections: sectionAverages.slice(0, 3), // Bottom 3 sections
      totalAtRisk: atRiskStudents.length
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch analytics" },
      { status: 500 }
    )
  }
}
