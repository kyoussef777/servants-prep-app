import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/roles"


// PATCH /api/lessons/[id] - Update a lesson (Priest/Servant)
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
    const { title, subtitle, description, scheduledDate, examSectionId, status, cancellationReason } = body

    const updateData: any = {}
    if (title) updateData.title = title
    if (subtitle !== undefined) updateData.subtitle = subtitle || null
    if (description !== undefined) updateData.description = description || null
    if (scheduledDate) updateData.scheduledDate = new Date(scheduledDate)
    if (examSectionId) updateData.examSectionId = examSectionId
    if (status) updateData.status = status
    if (cancellationReason !== undefined) updateData.cancellationReason = cancellationReason

    const lesson = await prisma.lesson.update({
      where: { id },
      data: updateData,
      include: {
        examSection: true,
        _count: {
          select: {
            attendanceRecords: true
          }
        }
      }
    })

    return NextResponse.json(lesson)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update lesson" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}

// DELETE /api/lessons/[id] - Delete a lesson (Priest only)
export async function DELETE(
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

    await prisma.lesson.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Lesson deleted successfully" })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete lesson" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}
