import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import { handleApiError } from "@/lib/api-utils"

// POST /api/users/bulk-reset-password - Bulk reset passwords (SUPER_ADMIN only)
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    // Only SUPER_ADMIN can bulk reset passwords
    if (user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: "Only super admins can bulk reset passwords" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userIds, newPassword } = body

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "userIds must be a non-empty array" },
        { status: 400 }
      )
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      )
    }

    // Prevent resetting your own password through bulk action
    if (userIds.includes(user.id)) {
      return NextResponse.json(
        { error: "You cannot reset your own password through bulk action. Use the change password page instead." },
        { status: 400 }
      )
    }

    // Hash the new password once
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Get target users for validation and response
    const targetUsers = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    })

    // Check for SUPER_ADMINs in the list - only the current super admin can reset other super admins' passwords
    // For safety, we'll still allow it but log a warning
    const superAdminsInList = targetUsers.filter(u => u.role === UserRole.SUPER_ADMIN)

    // Update all users' passwords and set mustChangePassword to true
    const result = await prisma.user.updateMany({
      where: {
        id: { in: userIds }
      },
      data: {
        password: hashedPassword,
        mustChangePassword: true
      }
    })

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      users: targetUsers.map(u => ({ id: u.id, name: u.name, email: u.email })),
      message: `Password reset for ${result.count} user(s). They will be prompted to change password on next login.`,
      superAdminsIncluded: superAdminsInList.length
    })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
