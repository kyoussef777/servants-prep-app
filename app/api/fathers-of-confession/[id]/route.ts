import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/roles"

// GET /api/fathers-of-confession/[id] - Get a specific father of confession
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    if (!isAdmin(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const father = await prisma.fatherOfConfession.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        church: true,
        isActive: true,
        _count: {
          select: { students: true }
        }
      }
    })

    if (!father) {
      return NextResponse.json(
        { error: "Father of confession not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(father)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch father of confession" },
      { status: 500 }
    )
  }
}

// PATCH /api/fathers-of-confession/[id] - Update a father of confession
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    if (!isAdmin(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, phone, church, isActive } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (phone !== undefined) updateData.phone = phone?.trim() || null
    if (church !== undefined) updateData.church = church?.trim() || null
    if (isActive !== undefined) updateData.isActive = isActive

    const father = await prisma.fatherOfConfession.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        church: true,
        isActive: true,
      }
    })

    return NextResponse.json(father)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update father of confession" },
      { status: 500 }
    )
  }
}

// DELETE /api/fathers-of-confession/[id] - Delete a father of confession (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    if (!isAdmin(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // Soft delete by setting isActive to false
    await prisma.fatherOfConfession.update({
      where: { id },
      data: { isActive: false }
    })

    // Also remove assignment from all students
    await prisma.studentEnrollment.updateMany({
      where: { fatherOfConfessionId: id },
      data: { fatherOfConfessionId: null }
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete father of confession" },
      { status: 500 }
    )
  }
}
