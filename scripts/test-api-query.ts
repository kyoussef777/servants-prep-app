import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    // Get academic year
    const year = await prisma.academicYear.findFirst({
      where: { name: '2025-2026', isActive: true }
    })

    if (!year) {
      console.log('❌ No active academic year found')
      return
    }

    console.log('✅ Found active year:', year.name)

    // Try the same query the API uses
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

    // Show first lesson to check structure
    if (lessons.length > 0) {
      console.log('\nFirst lesson sample:')
      console.log(JSON.stringify(lessons[0], null, 2))
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
