import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { UserRole } from "@prisma/client"

// DELETE /api/users/bulk-delete - Delete multiple users (SUPER_ADMIN only)
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    // Only SUPER_ADMIN can bulk delete users
    if (user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: "Forbidden - Only super admins can delete users in bulk" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userIds } = body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "userIds array is required" },
        { status: 400 }
      )
    }

    // Prevent deleting yourself
    if (userIds.includes(user.id)) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      )
    }

    // Get users to check if any are SUPER_ADMIN
    const usersToDelete = await prisma.user.findMany({
      where: {
        id: {
          in: userIds
        }
      },
      select: {
        id: true,
        role: true,
        name: true
      }
    })

    // Check if trying to delete other super admins
    const otherSuperAdmins = usersToDelete.filter(u => u.role === UserRole.SUPER_ADMIN && u.id !== user.id)
    if (otherSuperAdmins.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete other super admin accounts" },
        { status: 403 }
      )
    }

    // Delete all related data first (cascade should handle most of this, but being explicit)
    // Delete enrollments (which will cascade to other relations)
    await prisma.studentEnrollment.deleteMany({
      where: {
        studentId: {
          in: userIds
        }
      }
    })

    // Delete the users
    const result = await prisma.user.deleteMany({
      where: {
        id: {
          in: userIds
        }
      }
    })

    return NextResponse.json({
      message: `Successfully deleted ${result.count} user(s)`,
      deletedCount: result.count
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete users" },
      { status: 500 }
    )
  }
}
