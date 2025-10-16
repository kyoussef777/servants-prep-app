import { PrismaClient, ExamSectionType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Creating exam sections...')

  const sectionsToCreate = [
    { name: ExamSectionType.BIBLE_STUDIES, displayName: 'Bible Studies' },
    { name: ExamSectionType.DOGMA, displayName: 'Dogma' },
    { name: ExamSectionType.COMPARATIVE_THEOLOGY, displayName: 'Comparative Theology' },
    { name: ExamSectionType.RITUAL_THEOLOGY_SACRAMENTS, displayName: 'Ritual Theology & Sacraments' },
    { name: ExamSectionType.CHURCH_HISTORY_COPTIC_HERITAGE, displayName: 'Church History & Coptic Heritage' },
    { name: ExamSectionType.SPIRITUALITY_OF_SERVANT, displayName: 'The Spirituality of the Servant' },
    { name: ExamSectionType.PSYCHOLOGY_METHODOLOGY, displayName: 'Psychology & Methodology' },
  ]

  for (const section of sectionsToCreate) {
    const created = await prisma.examSection.upsert({
      where: { name: section.name },
      update: { displayName: section.displayName },
      create: {
        name: section.name,
        displayName: section.displayName,
        passingScore: 60,
        averageRequirement: 75
      }
    })
    console.log(`✅ ${section.displayName}:`, created.id)
  }

  console.log('\n✅ All sections created')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
