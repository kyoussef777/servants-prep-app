import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import { canManageUsers, canManageAllUsers } from "@/lib/roles"

// GET /api/users/[id] - Get a specific user
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAuth()
    const { id } = await params

    // Users can view their own profile, or admins can view anyone's
    if (currentUser.id !== id && !canManageUsers(currentUser.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(user)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch user" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}

// PATCH /api/users/[id] - Update a user
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAuth()
    const { id } = await params
    const body = await request.json()
    const { email, name, phone, password, role } = body

    // Get the user being updated
    const targetUser = await prisma.user.findUnique({ where: { id } })

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Users can update their own profile (name, email)
    const isSelf = currentUser.id === id
    const canManage = canManageUsers(currentUser.role)

    if (!isSelf && !canManage) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // SERVANT_PREP can only update STUDENT and MENTOR users
    if (currentUser.role === UserRole.SERVANT_PREP && targetUser.role !== UserRole.STUDENT && targetUser.role !== UserRole.MENTOR) {
      return NextResponse.json(
        { error: "Servants Prep can only update Student and Mentor users" },
        { status: 403 }
      )
    }

    const updateData: any = {}

    if (email) updateData.email = email
    if (name) updateData.name = name
    if (phone !== undefined) updateData.phone = phone || null

    // Role change permissions:
    // - SUPER_ADMIN: Can change any role
    // - SERVANT_PREP: Can only change between STUDENT and MENTOR
    if (role) {
      if (canManageAllUsers(currentUser.role)) {
        // SUPER_ADMIN can change any role
        updateData.role = role
      } else if (currentUser.role === UserRole.SERVANT_PREP) {
        // SERVANT_PREP can only set STUDENT or MENTOR roles
        if (role === UserRole.STUDENT || role === UserRole.MENTOR) {
          updateData.role = role
        }
      }
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        updatedAt: true,
      }
    })

    return NextResponse.json(user)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update user" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}

// DELETE /api/users/[id] - Delete a user
// SUPER_ADMIN can delete anyone, SERVANT_PREP can only delete STUDENT and MENTOR users
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAuth()
    const { id } = await params

    // Check if user can manage users
    if (!canManageUsers(currentUser.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // Prevent deleting yourself
    if (currentUser.id === id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      )
    }

    // Get the user being deleted
    const targetUser = await prisma.user.findUnique({ where: { id } })

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // SERVANT_PREP can only delete STUDENT and MENTOR users
    if (currentUser.role === UserRole.SERVANT_PREP && targetUser.role !== UserRole.STUDENT && targetUser.role !== UserRole.MENTOR) {
      return NextResponse.json(
        { error: "Servants Prep can only delete Student and Mentor users" },
        { status: 403 }
      )
    }

    await prisma.user.delete({
      where: { id }
    })

    return NextResponse.json({ message: "User deleted successfully" })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete user" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}
