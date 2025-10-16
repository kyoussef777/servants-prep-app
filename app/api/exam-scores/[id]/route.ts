import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/roles"


// PATCH /api/exam-scores/[id] - Update an exam score (Priest/Servant)
export async function PATCH(
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
    const body = await request.json()
    const { score, notes } = body

    if (score === undefined) {
      return NextResponse.json(
        { error: "Score is required" },
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

    const percentage = (score / examScore.exam.totalPoints) * 100

    const updateData: any = {
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
