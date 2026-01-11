import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canManageExams } from "@/lib/roles"


// PATCH /api/exam-scores/[id] - Update an exam score (SUPER_ADMIN and SERVANT_PREP only, PRIEST is read-only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    // PRIEST is read-only, only SUPER_ADMIN and SERVANT_PREP can manage exam scores
    if (!canManageExams(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }
    const { id } = await params
    const body = await request.json()
    const { score, notes } = body

    if (score === undefined) {
      return NextResponse.json(
        { error: "Score is required" },
        { status: 400 }
      )
    }

    // Validate score is a number
    if (typeof score !== 'number' || isNaN(score)) {
      return NextResponse.json(
        { error: "Score must be a valid number" },
        { status: 400 }
      )
    }

    // Validate score is not negative
    if (score < 0) {
      return NextResponse.json(
        { error: "Score cannot be negative" },
        { status: 400 }
      )
    }

    // Get the exam score with exam details
    const examScore = await prisma.examScore.findUnique({
      where: { id },
      include: {
        exam: true
      }
    })

    if (!examScore) {
      return NextResponse.json(
        { error: "Exam score not found" },
        { status: 404 }
      )
    }

    // Validate score doesn't exceed total points
    if (score > examScore.exam.totalPoints) {
      return NextResponse.json(
        { error: `Score cannot exceed total points (${examScore.exam.totalPoints})` },
        { status: 400 }
      )
    }

    const percentage = (score / examScore.exam.totalPoints) * 100

    const updateData: {
      score: number
      percentage: number
      gradedBy: string
      notes?: string | null
    } = {
      score,
      percentage,
      gradedBy: user.id,
    }

    if (notes !== undefined) {
      updateData.notes = notes || null
    }

    const updatedScore = await prisma.examScore.update({
      where: { id },
      data: updateData,
      include: {
        student: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    return NextResponse.json(updatedScore)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update exam score" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}
