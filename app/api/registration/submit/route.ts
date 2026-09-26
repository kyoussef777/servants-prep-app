import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isInviteCodeValid } from '@/lib/registration-utils'
import { StudentGrade, RegistrationStatus } from '@prisma/client'
import { notifyNewRegistration } from '@/lib/notifications'
import { normalizeEmail, normalizeOptionalEmail } from '@/lib/email'

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
      profileImageUrl,
      profileImageFilename,
      mentorName,
      mentorPhone,
      mentorEmail,
    } = body
    const normalizedEmail = normalizeEmail(email)
    const normalizedMentorEmail = normalizeOptionalEmail(mentorEmail)
    const normalizedMentorName = typeof mentorName === 'string' ? mentorName.trim() || null : null
    const normalizedMentorPhone = typeof mentorPhone === 'string' ? mentorPhone.trim() || null : null
    const normalizedApprovalFormUrl = typeof approvalFormUrl === 'string' ? approvalFormUrl.trim() || null : null
    const normalizedApprovalFormFilename = typeof approvalFormFilename === 'string' ? approvalFormFilename.trim() || null : null
    const hasApprovalForm = Boolean(normalizedApprovalFormUrl && normalizedApprovalFormFilename)

    // Validate required fields
    if (
      !inviteCode ||
      !normalizedEmail ||
      !fullName ||
      !dateOfBirth ||
      !phone ||
      !fatherOfConfessionName ||
      previouslyServed === undefined ||
      currentlyServing === undefined ||
      previouslyAttendedPrep === undefined ||
      !grade ||
      !profileImageUrl ||
      !profileImageFilename
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail) || (normalizedMentorEmail && !emailRegex.test(normalizedMentorEmail))) {
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

      // Existing users re-register every year. Link the submission to their
      // account so approval updates it instead of creating a duplicate user.
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      })

      // One open application per email at a time
      const pendingSubmission = await tx.registrationSubmission.findFirst({
        where: {
          email: normalizedEmail,
          status: RegistrationStatus.PENDING,
        },
        select: { id: true },
      })

      if (pendingSubmission) {
        throw new Error('A registration with this email is already pending review')
      }

      // An approved application only blocks a new one within the same
      // academic year. With no active year, fall back to blocking approved
      // applications for emails that do not have an account yet.
      const activeYear = await tx.academicYear.findFirst({
        where: { isActive: true },
        select: { startDate: true },
      })

      if (activeYear || !existingUser) {
        const approvedSubmission = await tx.registrationSubmission.findFirst({
          where: {
            email: normalizedEmail,
            status: RegistrationStatus.APPROVED,
            ...(activeYear ? { createdAt: { gte: activeYear.startDate } } : {}),
          },
          select: { id: true },
        })

        if (approvedSubmission) {
          throw new Error(
            activeYear
              ? 'A registration with this email has already been approved for this year'
              : 'A registration with this email has already been approved'
          )
        }
      }

      // Create submission
      const newSubmission = await tx.registrationSubmission.create({
        data: {
          inviteCodeId: code.id,
          status: RegistrationStatus.PENDING,
          email: normalizedEmail,
          fullName,
          dateOfBirth: new Date(dateOfBirth),
          phone,
          fatherOfConfessionName,
          previouslyServed,
          currentlyServing,
          previouslyAttendedPrep,
          previousPrepLocation: previousPrepLocation || null,
          grade: grade as StudentGrade,
          approvalFormUrl: hasApprovalForm ? normalizedApprovalFormUrl : null,
          approvalFormFilename: hasApprovalForm ? normalizedApprovalFormFilename : null,
          profileImageUrl,
          profileImageFilename,
          mentorName: normalizedMentorName,
          mentorPhone: normalizedMentorPhone,
          mentorEmail: normalizedMentorEmail,
          createdUserId: existingUser?.id ?? null,
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

    // Notify admins about new registration (non-blocking)
    notifyNewRegistration({
      applicantName: fullName,
      registrationId: submission.id,
    }).catch(() => {})

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
