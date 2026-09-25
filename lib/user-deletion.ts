import type { Prisma } from '@prisma/client'

export class UserDeletionConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserDeletionConflictError'
  }
}

export async function deleteUserWithRelations(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const [priestNoteCount, rosterImportCount, enrollment] = await Promise.all([
    tx.sundaySchoolPriestNote.count({ where: { authorId: userId } }),
    tx.sundaySchoolRosterImport.count({ where: { createdById: userId } }),
    tx.studentEnrollment.findUnique({
      where: { studentId: userId },
      select: { id: true },
    }),
  ])

  const protectedRecords: string[] = []
  if (priestNoteCount > 0) protectedRecords.push('confidential priest notes')
  if (rosterImportCount > 0) protectedRecords.push('Sunday School roster import history')

  if (protectedRecords.length > 0) {
    throw new UserDeletionConflictError(
      `This user cannot be deleted because they have ${protectedRecords.join(' and ')}. Disable the account instead to preserve this history.`,
    )
  }

  await tx.mentorAssignment.deleteMany({
    where: {
      OR: [
        { mentorUserId: userId },
        ...(enrollment ? [{ studentEnrollmentId: enrollment.id }] : []),
      ],
    },
  })
  await tx.sundaySchoolChildGuardian.deleteMany({ where: { parentId: userId } })
  await tx.userRoleAssignment.deleteMany({ where: { userId } })
  await tx.user.delete({ where: { id: userId } })
}
