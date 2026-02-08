import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInviteCodes } from '@/lib/roles'

/**
 * GET /api/registration/settings
 * Get registration system settings
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

    // Get or create default settings
    let settings = await prisma.systemSettings.findUnique({
      where: { id: 'default' },
    })

    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          id: 'default',
          registrationEnabled: true,
        },
      })
    }

    return NextResponse.json(settings)
  } catch (error: unknown) {
    console.error('Error fetching registration settings:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/registration/settings
 * Update registration system settings (enable/disable registration)
 * Auth: SUPER_ADMIN, SERVANT_PREP
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageInviteCodes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { registrationEnabled } = body

    if (typeof registrationEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'registrationEnabled must be a boolean' },
        { status: 400 }
      )
    }

    // Upsert settings (update if exists, create if not)
    const settings = await prisma.systemSettings.upsert({
      where: { id: 'default' },
      update: {
        registrationEnabled,
      },
      create: {
        id: 'default',
        registrationEnabled,
      },
    })

    return NextResponse.json(settings)
  } catch (error: unknown) {
    console.error('Error updating registration settings:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
