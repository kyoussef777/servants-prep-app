import { NextRequest, NextResponse } from 'next/server'
import { NotificationType, RegistrationStatus } from '@prisma/client'
import { requireAuth } from '@/lib/auth-helpers'
import { normalizeOptionalEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'

function getMissingDetails(submission: {
  approvalFormUrl: string | null
  approvalFormFilename: string | null
  mentorName: string | null
  mentorPhone: string | null
  mentorEmail: string | null
}) {
  return [
    !submission.approvalFormUrl || !submission.approvalFormFilename ? 'approvalForm' : null,
    !submission.mentorName || !submission.mentorPhone || !submission.mentorEmail
      ? 'mentorInformation'
      : null,
  ].filter((detail): detail is string => Boolean(detail))
}

async function getApprovedSubmission(userId: string) {
  return prisma.registrationSubmission.findFirst({
    where: {
      createdUserId: userId,
      status: RegistrationStatus.APPROVED,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      approvalFormUrl: true,
      approvalFormFilename: true,
      mentorName: true,
      mentorPhone: true,
      mentorEmail: true,
    },
  })
}

export async function GET() {
  try {
    const user = await requireAuth()
    const submission = await getApprovedSubmission(user.id)

    if (!submission) {
      return NextResponse.json({ error: 'Approved registration not found' }, { status: 404 })
    }

    const missingDetails = getMissingDetails(submission)
    return NextResponse.json({
      submission,
      missingDetails,
      complete: missingDetails.length === 0,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth()
    const existingSubmission = await getApprovedSubmission(user.id)

    if (!existingSubmission) {
      return NextResponse.json({ error: 'Approved registration not found' }, { status: 404 })
    }

    const body = await request.json()
    const mentorName = typeof body.mentorName === 'string' ? body.mentorName.trim() || null : null
    const mentorPhone = typeof body.mentorPhone === 'string' ? body.mentorPhone.trim() || null : null
    const mentorEmail = normalizeOptionalEmail(body.mentorEmail)

    if (mentorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mentorEmail)) {
      return NextResponse.json({ error: 'Invalid mentor email format' }, { status: 400 })
    }

    const submission = await prisma.$transaction(async (tx) => {
      const updatedSubmission = await tx.registrationSubmission.update({
        where: { id: existingSubmission.id },
        data: { mentorName, mentorPhone, mentorEmail },
        select: {
          id: true,
          approvalFormUrl: true,
          approvalFormFilename: true,
          mentorName: true,
          mentorPhone: true,
          mentorEmail: true,
        },
      })

      await tx.studentEnrollment.updateMany({
        where: { studentId: user.id },
        data: { mentorName, mentorPhone },
      })

      if (getMissingDetails(updatedSubmission).length === 0) {
        await tx.notification.deleteMany({
          where: {
            userId: user.id,
            type: NotificationType.REGISTRATION_INCOMPLETE,
            isPersistent: true,
          },
        })
      }

      return updatedSubmission
    })

    const missingDetails = getMissingDetails(submission)
    return NextResponse.json({
      submission,
      missingDetails,
      complete: missingDetails.length === 0,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: message === 'Unauthorized' ? 401 : 500 }
    )
  }
}
