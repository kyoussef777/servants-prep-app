import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canViewStudents } from "@/lib/roles"
import { UserRole } from "@prisma/client"
import { handleApiError } from "@/lib/api-utils"

// GET /api/dashboard/class-averages - Get class-wide exam section averages
export async function GET() {
  try {
    const user = await requireAuth()

    if (!canViewStudents(user.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all exam sections
    const examSections = await prisma.examSection.findMany({
      select: { id: true, name: true, displayName: true }
    })

    // Get all active student IDs
    const activeEnrollments = await prisma.studentEnrollment.findMany({
      where: { isActive: true },
      select: { studentId: true }
    })
    const studentIds = activeEnrollments.map(e => e.studentId)

    if (studentIds.length === 0) {
      return NextResponse.json({
        sectionAverages: [],
        overallAverage: null,
        totalStudents: 0
      })
    }

    // Get all exam scores for active students with section info
    const examScores = await prisma.examScore.findMany({
      where: {
        studentId: { in: studentIds }
      },
      select: {
        studentId: true,
        percentage: true,
        exam: {
          select: {
            examSectionId: true
          }
        }
      }
    })

    // Group scores by section
    const scoresBySection: Record<string, number[]> = {}
    for (const score of examScores) {
      const sectionId = score.exam.examSectionId
      if (!scoresBySection[sectionId]) {
        scoresBySection[sectionId] = []
      }
      scoresBySection[sectionId].push(score.percentage)
    }

    // Calculate per-section averages
    const sectionAverages = examSections.map(section => {
      const scores = scoresBySection[section.id] || []
      const average = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null
      return {
        sectionId: section.id,
        sectionName: section.name,
        displayName: section.displayName,
        average,
        scoreCount: scores.length
      }
    })

    // Calculate overall average across all scores
    const allScores = examScores.map(s => s.percentage)
    const overallAverage = allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : null

    return NextResponse.json({
      sectionAverages,
      overallAverage,
      totalStudents: studentIds.length,
      totalScores: allScores.length
    })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
