import { NotificationType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function getAnnualMentorRequirement(userId: string) {
  const [activeYear, enrollment] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { isActive: true },
      select: { id: true, name: true },
    }),
    prisma.studentEnrollment.findUnique({
      where: { studentId: userId },
      select: { id: true, isActive: true },
    }),
  ])

  if (!activeYear || !enrollment?.isActive) return null

  const information = await prisma.annualMentorInformation.findUnique({
    where: {
      studentId_academicYearId: {
        studentId: userId,
        academicYearId: activeYear.id,
      },
    },
  })

  return { activeYear, enrollment, information }
}

export async function ensureAnnualMentorReminder(userId: string) {
  const requirement = await getAnnualMentorRequirement(userId)
  if (!requirement || requirement.information) return

  const existingReminder = await prisma.notification.findFirst({
    where: {
      userId,
      type: NotificationType.REGISTRATION_INCOMPLETE,
      isPersistent: true,
      metadata: {
        path: ['academicYearId'],
        equals: requirement.activeYear.id,
      },
    },
    select: { id: true },
  })

  if (existingReminder) return

  await prisma.notification.create({
    data: {
      userId,
      type: NotificationType.REGISTRATION_INCOMPLETE,
      title: 'Mentor Information Required',
      body: `Please provide your mentor servant information for ${requirement.activeYear.name}. This reminder will remain until it is complete.`,
      url: '/dashboard/student/registration',
      isPersistent: true,
      metadata: {
        kind: 'annualMentorInformation',
        academicYearId: requirement.activeYear.id,
        missingDetails: ['mentor servant information'],
      },
    },
  })
}
