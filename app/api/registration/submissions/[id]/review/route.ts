import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canReviewRegistrations } from '@/lib/roles'
import { RegistrationStatus, UserRole, YearLevel } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { generateTempPassword } from '@/lib/registration-utils'

/**
 * POST /api/registration/submissions/[id]/review
 * Approve or reject a registration submission
 * Auth: SUPER_ADMIN, SERVANT_PREP
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canReviewRegistrations(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { action, note, yearLevel, academicYearId } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      // Approval logic - create User and Enrollment
      const result = await prisma.$transaction(async (tx) => {
        // Fetch submission
        const submission = await tx.registrationSubmission.findUnique({
          where: { id },
        })

        if (!submission) {
          throw new Error('Registration submission not found')
        }

        if (submission.status !== RegistrationStatus.PENDING) {
          throw new Error('Only pending submissions can be reviewed')
        }

        // Check if user with this email already exists
        const existingUser = await tx.user.findUnique({
          where: { email: submission.email },
        })

        if (existingUser) {
          throw new Error('A user with this email already exists')
        }

        // Generate temporary password
        const tempPassword = generateTempPassword()
        const hashedPassword = await bcrypt.hash(tempPassword, 10)

        // Get or create active academic year if not specified
        let targetAcademicYearId = academicYearId
        if (!targetAcademicYearId) {
          const activeYear = await tx.academicYear.findFirst({
            where: { isActive: true },
          })
          if (activeYear) {
            targetAcademicYearId = activeYear.id
          }
        }

        // Create User
        const newUser = await tx.user.create({
          data: {
            email: submission.email,
            name: submission.fullName,
            password: hashedPassword,
            role: UserRole.STUDENT,
            phone: submission.phone,
            profileImageUrl: submission.profileImageUrl,
            mustChangePassword: true,
            isDisabled: false,
          },
        })

        // Find or create Father of Confession
        let fatherOfConfessionId: string | null = null
        const existingFoC = await tx.fatherOfConfession.findFirst({
          where: {
            name: {
              equals: submission.fatherOfConfessionName,
              mode: 'insensitive',
            },
          },
        })

        if (existingFoC) {
          fatherOfConfessionId = existingFoC.id
        } else {
          const newFoC = await tx.fatherOfConfession.create({
            data: {
              name: submission.fatherOfConfessionName,
              isActive: true,
            },
          })
          fatherOfConfessionId = newFoC.id
        }

        // Create StudentEnrollment
        await tx.studentEnrollment.create({
          data: {
            studentId: newUser.id,
            yearLevel: (yearLevel as YearLevel) || YearLevel.YEAR_1,
            academicYearId: targetAcademicYearId || null,
            fatherOfConfessionId,
            mentorName: submission.mentorName,
            mentorPhone: submission.mentorPhone,
            isActive: true,
            notes: `Registered via invite code on ${new Date().toLocaleDateString()}`,
          },
        })

        // Update submission status
        const updatedSubmission = await tx.registrationSubmission.update({
          where: { id },
          data: {
            status: RegistrationStatus.APPROVED,
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            reviewNote: note || null,
            createdUserId: newUser.id,
          },
          include: {
            inviteCode: {
              select: {
                code: true,
                label: true,
              },
            },
            reviewer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            createdUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        })

        return {
          submission: updatedSubmission,
          tempPassword,
        }
      })

      return NextResponse.json({
        submission: result.submission,
        tempPassword: result.tempPassword,
        message: 'Registration approved successfully',
      })
    } else {
      // Rejection logic
      const submission = await prisma.registrationSubmission.findUnique({
        where: { id },
      })

      if (!submission) {
        return NextResponse.json(
          { error: 'Registration submission not found' },
          { status: 404 }
        )
      }

      if (submission.status !== RegistrationStatus.PENDING) {
        return NextResponse.json(
          { error: 'Only pending submissions can be reviewed' },
          { status: 400 }
        )
      }

      const updatedSubmission = await prisma.registrationSubmission.update({
        where: { id },
        data: {
          status: RegistrationStatus.REJECTED,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          reviewNote: note || null,
        },
        include: {
          inviteCode: {
            select: {
              code: true,
              label: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      return NextResponse.json({
        submission: updatedSubmission,
        message: 'Registration rejected',
      })
    }
  } catch (error: unknown) {
    console.error('Error reviewing registration submission:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('not found')
      ? 404
      : message.includes('pending') || message.includes('already exists')
      ? 400
      : 500

    return NextResponse.json({ error: message }, { status })
  }
}
