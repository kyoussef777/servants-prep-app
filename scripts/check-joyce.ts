import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find Joyce Mikhail
  const joyce = await prisma.user.findFirst({
    where: {
      name: { contains: 'Joyce' }
    },
    include: {
      enrollments: true
    }
  })
  
  console.log('Joyce user:', joyce)
  
  if (joyce) {
    // Check enrollment
    const enrollment = await prisma.studentEnrollment.findUnique({
      where: { studentId: joyce.id }
    })
    console.log('\nEnrollment:', enrollment)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
