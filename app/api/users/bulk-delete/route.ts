import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { AuditEventResult, Prisma, UserRole } from "@prisma/client"
import { recordAuditEvent } from "@/lib/audit"
import { deleteUserWithRelations, UserDeletionConflictError } from "@/lib/user-deletion"

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

    const uniqueUserIds = [...new Set(userIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
    if (uniqueUserIds.length !== userIds.length) {
      return NextResponse.json(
        { error: "userIds must contain unique, non-empty user IDs" },
        { status: 400 }
      )
    }

    // Prevent deleting yourself
    if (uniqueUserIds.includes(user.id)) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      )
    }

    // Get users to check if any are SUPER_ADMIN
    const usersToDelete = await prisma.user.findMany({
      where: {
        id: {
          in: uniqueUserIds
        }
      },
      select: {
        id: true,
        role: true,
        name: true,
        email: true,
      }
    })

    if (usersToDelete.length !== uniqueUserIds.length) {
      return NextResponse.json(
        { error: "One or more users could not be found" },
        { status: 404 }
      )
    }

    // Check if trying to delete other super admins
    const otherSuperAdmins = usersToDelete.filter(u => u.role === UserRole.SUPER_ADMIN && u.id !== user.id)
    if (otherSuperAdmins.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete other super admin accounts" },
        { status: 403 }
      )
    }

    await prisma.$transaction(async tx => {
      for (const id of uniqueUserIds) {
        await deleteUserWithRelations(tx, id)
      }
    })

    await Promise.all(usersToDelete.map(target => recordAuditEvent({
      actorUserId: user.id,
      action: "user.delete",
      entityType: "User",
      entityId: target.id,
      result: AuditEventResult.SUCCESS,
      metadata: {
        targetName: target.name,
        targetEmail: target.email,
        bulkDelete: true,
      },
    })))

    return NextResponse.json({
      message: `Successfully deleted ${usersToDelete.length} user(s)`,
      deletedCount: usersToDelete.length
    })
  } catch (error: unknown) {
    if (error instanceof UserDeletionConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { error: "One or more users still have related records and cannot be deleted. Disable those accounts instead, or remove the related assignments first." },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete users" },
      { status: 500 }
    )
  }
}
