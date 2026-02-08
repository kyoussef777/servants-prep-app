import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInviteCodes } from '@/lib/roles'
import { generateInviteCode } from '@/lib/registration-utils'

/**
 * GET /api/registration/invite-codes
 * List all invite codes (with optional status filter)
 * Auth: SUPER_ADMIN, SERVANT_PREP
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageInviteCodes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status')

    // Build where clause based on filter
    const where: any = {}
    const now = new Date()

    if (statusFilter === 'active') {
      where.isActive = true
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: now } }
      ]
    } else if (statusFilter === 'expired') {
      where.expiresAt = { lte: now }
    } else if (statusFilter === 'exhausted') {
      where.isActive = true
      where.maxUses = { gt: 0 }
      // Filter in memory for exhausted (usageCount >= maxUses)
    } else if (statusFilter === 'revoked') {
      where.isActive = false
    }

    const inviteCodes = await prisma.inviteCode.findMany({
      where,
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
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Filter exhausted codes in memory
    const filteredCodes = statusFilter === 'exhausted'
      ? inviteCodes.filter(code => code.maxUses > 0 && code.usageCount >= code.maxUses)
      : inviteCodes

    return NextResponse.json(filteredCodes)
  } catch (error: unknown) {
    console.error('Error fetching invite codes:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/registration/invite-codes
 * Generate a new invite code
 * Auth: SUPER_ADMIN, SERVANT_PREP
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageInviteCodes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { label, maxUses, expiresAt } = body

    // Validate inputs
    if (maxUses !== undefined && maxUses !== null) {
      if (typeof maxUses !== 'number' || maxUses < 0) {
        return NextResponse.json(
          { error: 'maxUses must be a non-negative number' },
          { status: 400 }
        )
      }
    }

    if (expiresAt && isNaN(Date.parse(expiresAt))) {
      return NextResponse.json(
        { error: 'expiresAt must be a valid date' },
        { status: 400 }
      )
    }

    // Generate unique code (retry up to 5 times if collision)
    let code: string | null = null
    let attempts = 0
    while (!code && attempts < 5) {
      const candidateCode = generateInviteCode()
      const existing = await prisma.inviteCode.findUnique({
        where: { code: candidateCode },
      })
      if (!existing) {
        code = candidateCode
      }
      attempts++
    }

    if (!code) {
      return NextResponse.json(
        { error: 'Failed to generate unique invite code' },
        { status: 500 }
      )
    }

    const inviteCode = await prisma.inviteCode.create({
      data: {
        code,
        label: label || null,
        maxUses: maxUses ?? 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: session.user.id,
      },
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

    return NextResponse.json(inviteCode, { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating invite code:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
