import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/roles"


// PATCH /api/academic-years/[id] - Update an academic year (Priest only)
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
    const { name, startDate, endDate, isActive } = body

    // If setting as active, deactivate all others
    if (isActive) {
      await prisma.academicYear.updateMany({
        where: {
          isActive: true,
          NOT: { id }
        },
        data: { isActive: false }
      })
    }

    const updateData: { name?: string; startDate?: Date; endDate?: Date; isActive?: boolean } = {}
    if (name) updateData.name = name
    if (startDate) updateData.startDate = new Date(startDate)
    if (endDate) updateData.endDate = new Date(endDate)
    if (isActive !== undefined) updateData.isActive = isActive

    const academicYear = await prisma.academicYear.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(academicYear)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update academic year" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}

// DELETE /api/academic-years/[id] - Delete an academic year (Priest only)
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

    await prisma.academicYear.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Academic year deleted successfully" })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete academic year" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}
