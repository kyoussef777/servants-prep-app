import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Testing lessons query...')

    const year = await prisma.academicYear.findFirst({
      where: { isActive: true }
    })

    if (!year) {
      console.log('❌ No active academic year')
      return
    }

    console.log('✅ Active year:', year.name)

    const lessons = await prisma.lesson.findMany({
      where: { academicYearId: year.id },
      include: {
        examSection: true,
        academicYear: {
          select: {
            id: true,
            name: true,
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
          }
        },
        _count: {
          select: {
            attendanceRecords: true
          }
        }
      },
      orderBy: {
        scheduledDate: 'asc'
      }
    })

    console.log(`✅ Found ${lessons.length} lessons`)

    if (lessons.length > 0) {
      console.log('\nFirst 3 lessons:')
      lessons.slice(0, 3).forEach(l => {
        console.log(`  ${l.lessonNumber}. ${l.title} (${l.examSection.displayName})`)
      })
    }

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
