import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/roles"
import { UserRole } from "@prisma/client"

// GET /api/dashboard/stats - Get dashboard statistics efficiently using counts
// This is MUCH faster than fetching all records and counting in JS
export async function GET() {
  try {
    const user = await requireAuth()

    if (!isAdmin(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // Get active academic year first
    const activeYear = await prisma.academicYear.findFirst({
      where: { isActive: true },
      select: { id: true, name: true }
    })

    if (!activeYear) {
      return NextResponse.json({
        totalStudents: 0,
        activeStudents: 0,
        totalLessons: 0,
        upcomingLessons: 0,
        completedLessons: 0,
        totalExams: 0,
        unassignedStudents: 0,
        academicYear: null
      })
    }

    const now = new Date()

    // Run all count queries in parallel for maximum performance
    const [
      totalStudents,
      activeStudents,
      totalLessons,
      upcomingLessons,
      completedLessons,
      totalExams,
      unassignedStudents
    ] = await Promise.all([
      // Total students
      prisma.user.count({
        where: { role: UserRole.STUDENT }
      }),

      // Active students (have active enrollment)
      prisma.studentEnrollment.count({
        where: { isActive: true }
      }),

      // Total lessons for current academic year
      prisma.lesson.count({
        where: { academicYearId: activeYear.id }
      }),

      // Upcoming lessons (scheduled, date > now)
      prisma.lesson.count({
        where: {
          academicYearId: activeYear.id,
          status: 'SCHEDULED',
          scheduledDate: { gt: now }
        }
      }),

      // Completed lessons
      prisma.lesson.count({
        where: {
          academicYearId: activeYear.id,
          status: 'COMPLETED'
        }
      }),

      // Total exams for current academic year
      prisma.exam.count({
        where: { academicYearId: activeYear.id }
      }),

      // Unassigned students (active enrollment but no mentor)
      prisma.studentEnrollment.count({
        where: {
          isActive: true,
          mentorId: null
        }
      })
    ])

    return NextResponse.json({
      totalStudents,
      activeStudents,
      totalLessons,
      upcomingLessons,
      completedLessons,
      totalExams,
      unassignedStudents,
      academicYear: activeYear.name
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch stats" },
      { status: 500 }
    )
  }
}
