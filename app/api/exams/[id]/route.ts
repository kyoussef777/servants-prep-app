import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/roles"

// DELETE /api/exams/[id] - Delete an exam (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user has admin access
    if (!isAdmin(session.user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const { id: examId } = await params

    // Check if exam exists
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        _count: {
          select: { scores: true }
        }
      }
    })

    if (!exam) {
      return NextResponse.json(
        { error: "Exam not found" },
        { status: 404 }
      )
    }

    // Delete all associated scores first
    await prisma.examScore.deleteMany({
      where: { examId }
    })

    // Delete the exam
    await prisma.exam.delete({
      where: { id: examId }
    })

    return NextResponse.json(
      { message: "Exam deleted successfully" },
      { status: 200 }
    )
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete exam" },
      { status: error instanceof Error && error.message === "Forbidden" ? 403 : 500 }
    )
  }
}
