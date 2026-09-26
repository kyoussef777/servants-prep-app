import { NextRequest, NextResponse } from 'next/server'
import { NotificationType, RegistrationStatus } from '@prisma/client'
import { requireAuth } from '@/lib/auth-helpers'
import { normalizeOptionalEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'

async function getCompletionState(userId: string) {
  const [activeYear, enrollment, submission] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { isActive: true },
      select: { id: true, name: true },
    }),
    prisma.studentEnrollment.findUnique({
      where: { studentId: userId },
      select: { id: true, isActive: true },
    }),
    prisma.registrationSubmission.findFirst({
      where: { createdUserId: userId, status: RegistrationStatus.APPROVED },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        approvalFormUrl: true,
        approvalFormFilename: true,
        mentorName: true,
        mentorPhone: true,
        mentorEmail: true,
      },
    }),
  ])

  if (!activeYear) throw new Error('No active academic year is configured')
  if (!enrollment?.isActive) throw new Error('Active student enrollment not found')

  const mentorInformation = await prisma.annualMentorInformation.findUnique({
    where: {
      studentId_academicYearId: {
        studentId: userId,
        academicYearId: activeYear.id,
      },
    },
    select: { mentorName: true, mentorPhone: true, mentorEmail: true },
  })

  const missingDetails = [
    submission && (!submission.approvalFormUrl || !submission.approvalFormFilename)
      ? 'approvalForm'
      : null,
    !mentorInformation ? 'mentorInformation' : null,
  ].filter((detail): detail is string => Boolean(detail))

  return { activeYear, enrollment, submission, mentorInformation, missingDetails }
}

export async function GET() {
  try {
    const user = await requireAuth()
    const state = await getCompletionState(user.id)

    return NextResponse.json({
      academicYear: state.activeYear,
      submission: {
        approvalFormUrl: state.submission?.approvalFormUrl ?? null,
        approvalFormFilename: state.submission?.approvalFormFilename ?? null,
        mentorName: state.mentorInformation?.mentorName ?? state.submission?.mentorName ?? null,
        mentorPhone: state.mentorInformation?.mentorPhone ?? state.submission?.mentorPhone ?? null,
        mentorEmail: state.mentorInformation?.mentorEmail ?? state.submission?.mentorEmail ?? null,
      },
      showApprovalForm: Boolean(state.submission),
      missingDetails: state.missingDetails,
      complete: state.missingDetails.length === 0,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message.includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth()
    const state = await getCompletionState(user.id)
    const body = await request.json()
    const mentorName = typeof body.mentorName === 'string' ? body.mentorName.trim() : ''
    const mentorPhone = typeof body.mentorPhone === 'string' ? body.mentorPhone.trim() : ''
    const mentorEmail = normalizeOptionalEmail(body.mentorEmail) ?? ''

    if (!mentorName || !mentorPhone || !mentorEmail) {
      return NextResponse.json(
        { error: 'Mentor name, phone number, and email are all required' },
        { status: 400 }
      )
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mentorEmail)) {
      return NextResponse.json({ error: 'Invalid mentor email format' }, { status: 400 })
    }

    const approvalComplete = !state.submission || Boolean(
      state.submission.approvalFormUrl && state.submission.approvalFormFilename
    )

    const mentorInformation = await prisma.$transaction(async (tx) => {
      const information = await tx.annualMentorInformation.upsert({
        where: {
          studentId_academicYearId: {
            studentId: user.id,
            academicYearId: state.activeYear.id,
          },
        },
        create: {
          studentId: user.id,
          academicYearId: state.activeYear.id,
          mentorName,
          mentorPhone,
          mentorEmail,
        },
        update: { mentorName, mentorPhone, mentorEmail, submittedAt: new Date() },
      })

      await tx.studentEnrollment.update({
        where: { id: state.enrollment.id },
        data: { mentorName, mentorPhone },
      })

      if (approvalComplete) {
        await tx.notification.deleteMany({
          where: {
            userId: user.id,
            type: NotificationType.REGISTRATION_INCOMPLETE,
            isPersistent: true,
          },
        })
      }

      return information
    })

    return NextResponse.json({
      academicYear: state.activeYear,
      submission: {
        approvalFormUrl: state.submission?.approvalFormUrl ?? null,
        approvalFormFilename: state.submission?.approvalFormFilename ?? null,
        mentorName: mentorInformation.mentorName,
        mentorPhone: mentorInformation.mentorPhone,
        mentorEmail: mentorInformation.mentorEmail,
      },
      showApprovalForm: Boolean(state.submission),
      missingDetails: approvalComplete ? [] : ['approvalForm'],
      complete: approvalComplete,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message.includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
