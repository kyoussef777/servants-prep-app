import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const sections = await prisma.examSection.findMany()
  console.log('All exam sections:')
  sections.forEach(s => {
    console.log(`  ${s.name}: "${s.displayName}" (id: ${s.id})`)
  })
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e)
    prisma.$disconnect()
  })
