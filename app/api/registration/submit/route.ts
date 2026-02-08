import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isInviteCodeValid } from '@/lib/registration-utils'
import { StudentGrade, RegistrationStatus } from '@prisma/client'

/**
 * POST /api/registration/submit
 * Submit a registration form (public endpoint, requires valid invite code)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      inviteCode,
      email,
      fullName,
      dateOfBirth,
      phone,
      fatherOfConfessionName,
      previouslyServed,
      currentlyServing,
      previouslyAttendedPrep,
      previousPrepLocation,
      grade,
      approvalFormUrl,
      approvalFormFilename,
      mentorName,
      mentorPhone,
      mentorEmail,
    } = body

    // Validate required fields
    if (
      !inviteCode ||
      !email ||
      !fullName ||
      !dateOfBirth ||
      !phone ||
      !fatherOfConfessionName ||
      previouslyServed === undefined ||
      currentlyServing === undefined ||
      previouslyAttendedPrep === undefined ||
      !grade ||
      !approvalFormUrl ||
      !approvalFormFilename ||
      !mentorName ||
      !mentorPhone ||
      !mentorEmail
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate grade enum
    if (!Object.values(StudentGrade).includes(grade as StudentGrade)) {
      return NextResponse.json(
        { error: 'Invalid grade selection' },
        { status: 400 }
      )
    }

    // Validate previousPrepLocation is required if previouslyAttendedPrep is true
    if (previouslyAttendedPrep && !previousPrepLocation) {
      return NextResponse.json(
        { error: 'Previous prep location is required when you have attended before' },
        { status: 400 }
      )
    }

    // Check if registration is enabled
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'default' },
    })

    if (settings && !settings.registrationEnabled) {
      return NextResponse.json(
        { error: 'Registration is currently closed' },
        { status: 403 }
      )
    }

    // Use a transaction to validate and create submission atomically
    const submission = await prisma.$transaction(async (tx) => {
      // Validate invite code
      const code = await tx.inviteCode.findUnique({
        where: { code: inviteCode.toUpperCase().trim() },
      })

      if (!code) {
        throw new Error('Invalid invite code')
      }

      const validation = isInviteCodeValid(code)
      if (!validation.valid) {
        throw new Error('Invalid or expired invite code')
      }

      // Check if code can still be used
      if (code.maxUses > 0 && code.usageCount >= code.maxUses) {
        throw new Error('Invite code has reached maximum usage')
      }

      // Check for duplicate pending/approved submission with same email
      const existingSubmission = await tx.registrationSubmission.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          status: {
            in: [RegistrationStatus.PENDING, RegistrationStatus.APPROVED],
          },
        },
      })

      if (existingSubmission) {
        throw new Error(
          'A registration with this email is already pending or approved'
        )
      }

      // Check if a user with this email already exists
      const existingUser = await tx.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      })

      if (existingUser) {
        throw new Error('A user with this email already exists')
      }

      // Create submission
      const newSubmission = await tx.registrationSubmission.create({
        data: {
          inviteCodeId: code.id,
          status: RegistrationStatus.PENDING,
          email: email.toLowerCase().trim(),
          fullName,
          dateOfBirth: new Date(dateOfBirth),
          phone,
          fatherOfConfessionName,
          previouslyServed,
          currentlyServing,
          previouslyAttendedPrep,
          previousPrepLocation: previousPrepLocation || null,
          grade: grade as StudentGrade,
          approvalFormUrl,
          approvalFormFilename,
          mentorName,
          mentorPhone,
          mentorEmail,
        },
      })

      // Increment usage count
      await tx.inviteCode.update({
        where: { id: code.id },
        data: {
          usageCount: {
            increment: 1,
          },
        },
      })

      return newSubmission
    })

    return NextResponse.json(
      {
        id: submission.id,
        message:
          'Registration submitted successfully! Your application is under review.',
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error('Error submitting registration:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Invalid') || message.includes('expired') || message.includes('maximum usage')
      ? 400
      : message.includes('already')
      ? 409
      : 500

    return NextResponse.json({ error: message }, { status })
  }
}
