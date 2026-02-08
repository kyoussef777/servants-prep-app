import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isInviteCodeValid } from '@/lib/registration-utils'

/**
 * POST /api/registration/validate-code
 * Validate an invite code (public endpoint)
 * Returns generic error messages to avoid revealing code status
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, message: 'Invalid invite code' },
        { status: 400 }
      )
    }

    // Check if registration is enabled globally
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'default' },
    })

    if (settings && !settings.registrationEnabled) {
      return NextResponse.json(
        { valid: false, message: 'Registration is currently closed' },
        { status: 200 }
      )
    }

    // Find invite code
    const inviteCode = await prisma.inviteCode.findUnique({
      where: { code: code.toUpperCase().trim() },
    })

    if (!inviteCode) {
      return NextResponse.json(
        { valid: false, message: 'Invalid invite code' },
        { status: 200 }
      )
    }

    // Validate code status
    const validation = isInviteCodeValid(inviteCode)

    if (!validation.valid) {
      // Don't reveal specific reason - generic message
      return NextResponse.json(
        { valid: false, message: 'Invalid or expired invite code' },
        { status: 200 }
      )
    }

    return NextResponse.json({
      valid: true,
      codeId: inviteCode.id,
      label: inviteCode.label,
    })
  } catch (error: unknown) {
    console.error('Error validating invite code:', error)
    return NextResponse.json(
      { valid: false, message: 'An error occurred' },
      { status: 500 }
    )
  }
}
