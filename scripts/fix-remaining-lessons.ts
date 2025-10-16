import { PrismaClient, ExamSectionType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get sections
  const psychSection = await prisma.examSection.findUnique({
    where: { name: ExamSectionType.PSYCHOLOGY_METHODOLOGY }
  })

  if (!psychSection) {
    throw new Error('Psychology & Methodology section not found')
  }

  // Get academic year
  const year = await prisma.academicYear.findFirst({
    where: { name: '2025-2026' }
  })

  if (!year) {
    throw new Error('2025-2026 academic year not found')
  }

  // Update lessons 43-50 to Psychology & Methodology
  const result = await prisma.lesson.updateMany({
    where: {
      academicYearId: year.id,
      lessonNumber: {
        gte: 43,
        lte: 50
      }
    },
    data: {
      examSectionId: psychSection.id
    }
  })

  console.log(`✅ Updated ${result.count} lessons (L#43-50) to Psychology & Methodology`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
