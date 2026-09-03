import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { RegistrationStatus } from '@prisma/client'
import { notifyNewServantApplication } from '@/lib/notifications'

/**
 * POST /api/servant-applications/submit
 * Submit a Sunday School servant application (public endpoint, no invite
 * code — open registration, admin review is the safety net).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, fullName, phone, availability, motivation } = body

    if (!email || !fullName || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const application = await prisma.$transaction(async (tx) => {
      const existingApplication = await tx.servantApplication.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          status: {
            in: [RegistrationStatus.PENDING, RegistrationStatus.APPROVED],
          },
        },
      })

      if (existingApplication) {
        throw new Error(
          'An application with this email is already pending or approved'
        )
      }

      const existingUser = await tx.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      })

      if (existingUser) {
        throw new Error('A user with this email already exists')
      }

      return tx.servantApplication.create({
        data: {
          status: RegistrationStatus.PENDING,
          email: email.toLowerCase().trim(),
          fullName,
          phone,
          availability: availability || null,
          motivation: motivation || null,
        },
      })
    })

    notifyNewServantApplication({
      applicantName: fullName,
      applicationId: application.id,
    }).catch(() => {})

    return NextResponse.json(
      {
        id: application.id,
        message:
          'Application submitted successfully! Your application is under review.',
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error('Error submitting servant application:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('already') ? 409 : 500

    return NextResponse.json({ error: message }, { status })
  }
}
