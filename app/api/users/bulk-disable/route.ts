import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { UserRole } from "@prisma/client"
import { handleApiError } from "@/lib/api-utils"

// POST /api/users/bulk-disable - Bulk enable/disable users (SUPER_ADMIN only)
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    // Only SUPER_ADMIN can disable/enable users
    if (user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: "Only super admins can disable or enable users" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userIds, isDisabled } = body

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "userIds must be a non-empty array" },
        { status: 400 }
      )
    }

    if (typeof isDisabled !== 'boolean') {
      return NextResponse.json(
        { error: "isDisabled must be a boolean" },
        { status: 400 }
      )
    }

    // Prevent disabling yourself
    if (isDisabled && userIds.includes(user.id)) {
      return NextResponse.json(
        { error: "You cannot disable your own account" },
        { status: 400 }
      )
    }

    // Prevent disabling other SUPER_ADMINs (safety measure)
    const targetUsers = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        role: true,
        name: true
      }
    })

    const superAdminsInList = targetUsers.filter(u => u.role === UserRole.SUPER_ADMIN)
    if (isDisabled && superAdminsInList.length > 0) {
      return NextResponse.json(
        { error: `Cannot disable super admin accounts: ${superAdminsInList.map(u => u.name).join(', ')}` },
        { status: 400 }
      )
    }

    // Update all users
    const result = await prisma.user.updateMany({
      where: {
        id: { in: userIds },
        // Extra safety: never disable SUPER_ADMINs even if they somehow got in the list
        role: { not: UserRole.SUPER_ADMIN }
      },
      data: {
        isDisabled
      }
    })

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      action: isDisabled ? 'disabled' : 'enabled'
    })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
