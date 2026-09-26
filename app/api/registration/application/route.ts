import { NextRequest, NextResponse } from 'next/server'
import { NotificationType, RegistrationStatus } from '@prisma/client'
import { requireAuth } from '@/lib/auth-helpers'
import { normalizeOptionalEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'

type ApplicationDetails = {
  fatherOfConfessionName: string | null
  approvalFormUrl: string | null
  approvalFormFilename: string | null
  mentorName: string | null
  mentorPhone: string | null
  mentorEmail: string | null
}

function getMissingDetails(application: ApplicationDetails) {
  return [
    !application.fatherOfConfessionName ? 'fatherOfConfession' : null,
    !application.approvalFormUrl || !application.approvalFormFilename ? 'approvalForm' : null,
    !application.mentorName || !application.mentorPhone || !application.mentorEmail
      ? 'mentorInformation'
      : null,
  ].filter((detail): detail is string => Boolean(detail))
}

async function getApprovedApplication(userId: string) {
  return prisma.registrationSubmission.findFirst({
    where: { createdUserId: userId, status: RegistrationStatus.APPROVED },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fatherOfConfessionName: true,
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
    const application = await getApprovedApplication(user.id)

    if (!application) {
      return NextResponse.json({ error: 'Approved registration not found' }, { status: 404 })
    }

    const missingDetails = getMissingDetails(application)
    return NextResponse.json({
      application,
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
    const existingApplication = await getApprovedApplication(user.id)

    if (!existingApplication) {
      return NextResponse.json({ error: 'Approved registration not found' }, { status: 404 })
    }

    const body = await request.json()
    const fatherOfConfessionName = typeof body.fatherOfConfessionName === 'string'
      ? body.fatherOfConfessionName.trim()
      : ''
    const mentorName = typeof body.mentorName === 'string' ? body.mentorName.trim() : ''
    const mentorPhone = typeof body.mentorPhone === 'string' ? body.mentorPhone.trim() : ''
    const mentorEmail = normalizeOptionalEmail(body.mentorEmail) ?? ''

    if (!fatherOfConfessionName || !mentorName || !mentorPhone || !mentorEmail) {
      return NextResponse.json(
        { error: 'Father of confession and all mentor fields are required' },
        { status: 400 }
      )
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mentorEmail)) {
      return NextResponse.json({ error: 'Invalid mentor email format' }, { status: 400 })
    }

    const application = await prisma.$transaction(async (tx) => {
      let fatherOfConfession = await tx.fatherOfConfession.findFirst({
        where: { name: { equals: fatherOfConfessionName, mode: 'insensitive' } },
        select: { id: true },
      })

      fatherOfConfession ??= await tx.fatherOfConfession.create({
        data: { name: fatherOfConfessionName, isActive: true },
        select: { id: true },
      })

      const updatedApplication = await tx.registrationSubmission.update({
        where: { id: existingApplication.id },
        data: { fatherOfConfessionName, mentorName, mentorPhone, mentorEmail },
        select: {
          id: true,
          fatherOfConfessionName: true,
          approvalFormUrl: true,
          approvalFormFilename: true,
          mentorName: true,
          mentorPhone: true,
          mentorEmail: true,
        },
      })

      await tx.studentEnrollment.updateMany({
        where: { studentId: user.id },
        data: {
          fatherOfConfessionId: fatherOfConfession.id,
          mentorName,
          mentorPhone,
        },
      })

      if (getMissingDetails(updatedApplication).length === 0) {
        await tx.notification.deleteMany({
          where: {
            userId: user.id,
            type: NotificationType.REGISTRATION_INCOMPLETE,
            isPersistent: true,
          },
        })
      }

      return updatedApplication
    })

    const missingDetails = getMissingDetails(application)
    return NextResponse.json({
      application,
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
