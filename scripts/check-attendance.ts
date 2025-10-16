import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAttendance() {
  try {
    console.log('📊 Checking attendance records...\n')

    // Get total lessons
    const lessons = await prisma.lesson.findMany({
      include: {
        academicYear: true,
        examSection: true
      }
    })

    console.log(`Total lessons: ${lessons.length}`)

    // Get all students with enrollments
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        isActive: true
      },
      include: {
        student: true
      }
    })

    console.log(`Total active students: ${enrollments.length}\n`)

    // Get all attendance records
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      include: {
        student: true,
        lesson: {
          include: {
            examSection: true
          }
        }
      }
    })

    console.log(`Total attendance records: ${attendanceRecords.length}\n`)

    // Group by status
    const byStatus = {
      PRESENT: attendanceRecords.filter(r => r.status === 'PRESENT').length,
      LATE: attendanceRecords.filter(r => r.status === 'LATE').length,
      ABSENT: attendanceRecords.filter(r => r.status === 'ABSENT').length
    }

    console.log('📈 Records by status:')
    console.log(`  PRESENT: ${byStatus.PRESENT}`)
    console.log(`  LATE: ${byStatus.LATE}`)
    console.log(`  ABSENT: ${byStatus.ABSENT}\n`)

    // Calculate expected vs actual records
    const expectedRecords = lessons.length * enrollments.length
    const actualRecords = attendanceRecords.length
    const missingRecords = expectedRecords - actualRecords

    console.log('📋 Coverage:')
    console.log(`  Expected records (lessons × students): ${expectedRecords}`)
    console.log(`  Actual records: ${actualRecords}`)
    console.log(`  Missing records: ${missingRecords}\n`)

    if (missingRecords > 0) {
      console.log('⚠️  There are students without attendance records for some lessons.')
      console.log('   These will be calculated as ABSENT in analytics.\n')
    }

    // Check for any lessons with incomplete attendance
    console.log('📚 Lessons with incomplete attendance:\n')
    for (const lesson of lessons) {
      const recordsForLesson = attendanceRecords.filter(r => r.lessonId === lesson.id)
      const missingForLesson = enrollments.length - recordsForLesson.length

      if (missingForLesson > 0) {
        console.log(`  Lesson ${lesson.lessonNumber}: ${lesson.title}`)
        console.log(`    Date: ${lesson.scheduledDate.toLocaleDateString()}`)
        console.log(`    Section: ${lesson.examSection.displayName}`)
        console.log(`    Records: ${recordsForLesson.length}/${enrollments.length}`)
        console.log(`    Missing: ${missingForLesson}\n`)
      }
    }

    // Sample of attendance records
    console.log('📝 Sample records (first 10):\n')
    attendanceRecords.slice(0, 10).forEach(record => {
      console.log(`  ${record.student.name} - Lesson ${record.lesson.lessonNumber} - ${record.status}`)
    })

  } catch (error) {
    console.error('Error checking attendance:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAttendance()
