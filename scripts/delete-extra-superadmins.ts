import { PrismaClient, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Finding all SUPER_ADMIN users...\n')

  // Find all super admins
  const superAdmins = await prisma.user.findMany({
    where: { role: UserRole.SUPER_ADMIN },
    select: {
      id: true,
      email: true,
      name: true,
      _count: {
        select: {
          lessonsCreated: true,
          attendanceRecordedBy: true,
          examScoresGradedBy: true,
          mentoredStudents: true
        }
      }
    }
  })

  console.log(`Found ${superAdmins.length} SUPER_ADMIN users:`)
  superAdmins.forEach(admin => {
    console.log(`  - ${admin.name} (${admin.email})`)
    console.log(`    Created lessons: ${admin._count.lessonsCreated}`)
    console.log(`    Recorded attendance: ${admin._count.attendanceRecordedBy}`)
    console.log(`    Graded exam scores: ${admin._count.examScoresGradedBy}`)
    console.log(`    Mentoring students: ${admin._count.mentoredStudents}`)
  })

  // Find Kamal's user ID
  const kamal = superAdmins.find(admin => admin.email === 'kamal.youssef60@gmail.com')

  if (!kamal) {
    console.error('\n❌ Error: Could not find Kamal Youssef (kamal.youssef60@gmail.com)')
    console.log('Please ensure this user exists in the database.')
    return
  }

  console.log(`\n✓ Keeping: ${kamal.name} (${kamal.email})`)

  // Get users to delete
  const usersToDelete = superAdmins.filter(admin => admin.id !== kamal.id)

  if (usersToDelete.length === 0) {
    console.log('\n✓ No other super admins to delete.')
    return
  }

  console.log(`\n⚠️  Will delete ${usersToDelete.length} super admin(s):`)
  usersToDelete.forEach(admin => {
    console.log(`  - ${admin.name} (${admin.email})`)
  })

  // For each user to delete, reassign their data to Kamal
  for (const user of usersToDelete) {
    console.log(`\nProcessing ${user.name}...`)

    // Reassign lessons created by this user to Kamal
    if (user._count.lessonsCreated > 0) {
      const updatedLessons = await prisma.lesson.updateMany({
        where: { createdBy: user.id },
        data: { createdBy: kamal.id }
      })
      console.log(`  ✓ Reassigned ${updatedLessons.count} lessons to Kamal`)
    }

    // Reassign attendance records
    if (user._count.attendanceRecordedBy > 0) {
      const updatedAttendance = await prisma.attendanceRecord.updateMany({
        where: { recordedBy: user.id },
        data: { recordedBy: kamal.id }
      })
      console.log(`  ✓ Reassigned ${updatedAttendance.count} attendance records to Kamal`)
    }

    // Reassign exam scores
    if (user._count.examScoresGradedBy > 0) {
      const updatedScores = await prisma.examScore.updateMany({
        where: { gradedBy: user.id },
        data: { gradedBy: kamal.id }
      })
      console.log(`  ✓ Reassigned ${updatedScores.count} exam scores to Kamal`)
    }

    // Unassign as mentor (set mentorId to null for their mentees)
    if (user._count.mentoredStudents > 0) {
      const updatedEnrollments = await prisma.studentEnrollment.updateMany({
        where: { mentorId: user.id },
        data: { mentorId: null }
      })
      console.log(`  ✓ Unassigned ${updatedEnrollments.count} mentees`)
    }

    // Now safe to delete the user
    await prisma.user.delete({
      where: { id: user.id }
    })
    console.log(`  ✓ Deleted user: ${user.name}`)
  }

  console.log('\n✅ Successfully deleted all extra super admins!')
  console.log(`✅ Only remaining SUPER_ADMIN: ${kamal.name} (${kamal.email})`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('\n❌ Error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
