import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInviteCodes } from '@/lib/roles'

/**
 * PATCH /api/registration/invite-codes/[id]
 * Update an invite code (edit label, maxUses, expiresAt, or toggle isActive)
 * Auth: SUPER_ADMIN, SERVANT_PREP
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageInviteCodes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { label, maxUses, expiresAt, isActive } = body

    // Validate inputs
    if (maxUses !== undefined && maxUses !== null) {
      if (typeof maxUses !== 'number' || maxUses < 0) {
        return NextResponse.json(
          { error: 'maxUses must be a non-negative number' },
          { status: 400 }
        )
      }
    }

    if (expiresAt !== undefined && expiresAt !== null && isNaN(Date.parse(expiresAt))) {
      return NextResponse.json(
        { error: 'expiresAt must be a valid date or null' },
        { status: 400 }
      )
    }

    // Check if invite code exists
    const existingCode = await prisma.inviteCode.findUnique({
      where: { id },
    })

    if (!existingCode) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 })
    }

    // Build update data
    const updateData: any = {}
    if (label !== undefined) updateData.label = label
    if (maxUses !== undefined) updateData.maxUses = maxUses
    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null
    }
    if (isActive !== undefined) updateData.isActive = isActive

    const inviteCode = await prisma.inviteCode.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    })

    return NextResponse.json(inviteCode)
  } catch (error: unknown) {
    console.error('Error updating invite code:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/registration/invite-codes/[id]
 * Delete an invite code (only if it has no registrations)
 * Auth: SUPER_ADMIN, SERVANT_PREP
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageInviteCodes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Check if invite code exists and has registrations
    const existingCode = await prisma.inviteCode.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    })

    if (!existingCode) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 })
    }

    if (existingCode._count.registrations > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete invite code with existing registrations. Revoke it instead.',
        },
        { status: 409 }
      )
    }

    await prisma.inviteCode.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deleting invite code:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
