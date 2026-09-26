import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canReviewRegistrations } from '@/lib/roles'
import { NotificationType, RegistrationStatus, UserRole, YearLevel } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { generateTempPassword } from '@/lib/registration-utils'
import { notifyRegistrationReviewed } from '@/lib/notifications'
import { backfillAttendanceForStudent } from '@/lib/api-utils'

/**
 * POST /api/registration/submissions/[id]/review
 * Approve or reject a registration submission. Approving a returning
 * applicant's submission updates their existing account instead of creating one.
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

        // Returning applicants are linked to their account at submission.
        // Fall back to the email in case the account was created afterwards.
        const existingUser = submission.createdUserId
          ? await tx.user.findUnique({ where: { id: submission.createdUserId } })
          : await tx.user.findUnique({ where: { email: submission.email } })

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

        let userId: string
        let tempPassword: string | null = null
        let shouldBackfillAttendance = true

        if (existingUser) {
          // Yearly re-registration: refresh contact details on the existing
          // account. Password, role, and year level stay as they are.
          userId = existingUser.id
          await tx.user.update({
            where: { id: existingUser.id },
            data: {
              phone: submission.phone,
              profileImageUrl: submission.profileImageUrl ?? existingUser.profileImageUrl,
            },
          })

          const enrollment = await tx.studentEnrollment.findUnique({
            where: { studentId: existingUser.id },
            select: { id: true, isActive: true },
          })

          if (enrollment) {
            await tx.studentEnrollment.update({
              where: { id: enrollment.id },
              data: {
                fatherOfConfessionId,
                // Keep the mentor on file unless the applicant supplied one
                ...(submission.mentorName ? { mentorName: submission.mentorName } : {}),
                ...(submission.mentorPhone ? { mentorPhone: submission.mentorPhone } : {}),
              },
            })
            shouldBackfillAttendance = enrollment.isActive
          } else if (existingUser.role === UserRole.STUDENT) {
            await tx.studentEnrollment.create({
              data: {
                studentId: existingUser.id,
                yearLevel: (yearLevel as YearLevel) || YearLevel.YEAR_1,
                academicYearId: targetAcademicYearId || null,
                fatherOfConfessionId,
                mentorName: submission.mentorName,
                mentorPhone: submission.mentorPhone,
                isActive: true,
                notes: `Registered via invite code on ${new Date().toLocaleDateString()}`,
              },
            })
          } else {
            shouldBackfillAttendance = false
          }

          // Replace any reminder left over from a previous year's registration
          await tx.notification.deleteMany({
            where: {
              userId: existingUser.id,
              type: NotificationType.REGISTRATION_INCOMPLETE,
              isPersistent: true,
            },
          })
        } else {
          // Generate temporary password
          tempPassword = generateTempPassword()
          const hashedPassword = await bcrypt.hash(tempPassword, 10)

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
          userId = newUser.id

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
        }

        const missingRegistrationDetails = [
          !submission.approvalFormUrl || !submission.approvalFormFilename ? 'approval form' : null,
          !submission.mentorName || !submission.mentorPhone || !submission.mentorEmail
            ? 'mentor servant information'
            : null,
        ].filter((detail): detail is string => Boolean(detail))

        if (missingRegistrationDetails.length > 0) {
          await tx.notification.create({
            data: {
              userId,
              type: NotificationType.REGISTRATION_INCOMPLETE,
              title: 'Complete Your Registration',
              body: `Please add your ${missingRegistrationDetails.join(' and ')}. This reminder will remain until your registration is complete.`,
              url: '/dashboard/student/registration',
              isPersistent: true,
              metadata: {
                registrationId: submission.id,
                missingDetails: missingRegistrationDetails,
              },
            },
          })
        }

        // Backfill attendance records for all past lessons in this academic year
        if (shouldBackfillAttendance) {
          await backfillAttendanceForStudent(userId, targetAcademicYearId || null, tx)
        }

        // Update submission status
        const updatedSubmission = await tx.registrationSubmission.update({
          where: { id },
          data: {
            status: RegistrationStatus.APPROVED,
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            reviewNote: note || null,
            createdUserId: userId,
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
          linkedExistingUser: Boolean(existingUser),
        }
      })

      // Notify the newly approved user (non-blocking)
      if (result.submission.createdUser) {
        notifyRegistrationReviewed({
          userId: result.submission.createdUser.id,
          status: 'APPROVED',
          applicantName: result.submission.fullName,
        }).catch(() => {})
      }

      return NextResponse.json({
        submission: result.submission,
        tempPassword: result.tempPassword,
        linkedExistingUser: result.linkedExistingUser,
        message: result.linkedExistingUser
          ? 'Registration approved and linked to the existing account'
          : 'Registration approved successfully',
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
