import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { UserRole } from "@prisma/client"
import { isAdmin } from "@/lib/roles"

// GET /api/exam-scores - List all exam scores (Admins see all, Mentors see only their mentees)
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    // Build where clause based on role
    let where: any = {}

    // If MENTOR role, restrict to only their mentees
    if (user.role === UserRole.MENTOR) {
      // First, get list of student IDs assigned to this mentor
      const mentees = await prisma.studentEnrollment.findMany({
        where: { mentorId: user.id },
        select: { studentId: true }
      })
      const studentIds = mentees.map(m => m.studentId)

      where.studentId = { in: studentIds }
    } else if (!isAdmin(user.role) && user.role !== UserRole.STUDENT) {
      // Non-admin, non-mentor, non-student roles are forbidden
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    } else if (user.role === UserRole.STUDENT) {
      // Students can only see their own scores
      where.studentId = user.id
    }

    const scores = await prisma.examScore.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        exam: {
          select: {
            id: true,
            totalPoints: true,
            yearLevel: true,
            examDate: true,
            examSection: {
              select: {
                id: true,
                name: true,
                displayName: true
              }
            }
          }
        },
        grader: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        gradedAt: 'desc'
      }
    })

    return NextResponse.json(scores)
  } catch (error: unknown) {
    console.error('Error in GET /api/exam-scores:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch exam scores" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}
