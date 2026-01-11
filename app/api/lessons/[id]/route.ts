import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canManageCurriculum } from "@/lib/roles"


// PATCH /api/lessons/[id] - Update a lesson (SUPER_ADMIN and SERVANT_PREP only, PRIEST is read-only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    // PRIEST is read-only, only SUPER_ADMIN and SERVANT_PREP can manage curriculum
    if (!canManageCurriculum(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }
    const { id } = await params
    const body = await request.json()
    const { title, subtitle, description, scheduledDate, examSectionId, status, cancellationReason, resources, isExamDay } = body

    const updateData: Record<string, unknown> = {}
    if (title) updateData.title = title
    if (subtitle !== undefined) updateData.subtitle = subtitle || null
    if (description !== undefined) updateData.description = description || null
    if (scheduledDate) updateData.scheduledDate = new Date(scheduledDate)
    if (examSectionId) updateData.examSection = { connect: { id: examSectionId } }
    if (status) updateData.status = status
    if (cancellationReason !== undefined) updateData.cancellationReason = cancellationReason
    if (isExamDay !== undefined) updateData.isExamDay = isExamDay

    // Handle resources update: delete all existing and recreate
    if (resources !== undefined) {
      await prisma.lessonResource.deleteMany({
        where: { lessonId: id }
      })

      if (resources.length > 0) {
        await prisma.lessonResource.createMany({
          data: resources.map((r: { title: string; url: string; type?: string }) => ({
            lessonId: id,
            title: r.title,
            url: r.url,
            type: r.type || null,
          }))
        })
      }
    }

    const lesson = await prisma.lesson.update({
      where: { id },
      data: updateData,
      include: {
        examSection: true,
        resources: {
          orderBy: {
            createdAt: 'asc'
          }
        },
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

// DELETE /api/lessons/[id] - Delete a lesson (SUPER_ADMIN and SERVANT_PREP only, PRIEST is read-only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    // PRIEST is read-only, only SUPER_ADMIN and SERVANT_PREP can manage curriculum
    if (!canManageCurriculum(user.role)) {
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
