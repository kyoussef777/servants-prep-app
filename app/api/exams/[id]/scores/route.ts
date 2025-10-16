import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/roles"


// GET /api/exams/[id]/scores - Get scores for an exam
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    // Check if user has admin access
    if (!isAdmin(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }
    const { id } = await params

    const scores = await prisma.examScore.findMany({
      where: { examId: id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
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
        percentage: 'desc'
      }
    })

    return NextResponse.json(scores)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch exam scores" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}

// POST /api/exams/[id]/scores - Add score for a student (Priest/Servant)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    // Check if user has admin access
    if (!isAdmin(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }
    const { id: examId } = await params
    const body = await request.json()
    const { studentId, score, notes } = body

    if (!studentId || score === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Get exam to calculate percentage
    const exam = await prisma.exam.findUnique({
      where: { id: examId }
    })

    if (!exam) {
      return NextResponse.json(
        { error: "Exam not found" },
        { status: 404 }
      )
    }

    const percentage = (score / exam.totalPoints) * 100

    // Check if score already exists
    const existing = await prisma.examScore.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Score already exists for this student" },
        { status: 400 }
      )
    }

    const examScore = await prisma.examScore.create({
      data: {
        examId,
        studentId,
        score,
        percentage,
        notes: notes || null,
        gradedBy: user.id,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    return NextResponse.json(examScore, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create exam score" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}
