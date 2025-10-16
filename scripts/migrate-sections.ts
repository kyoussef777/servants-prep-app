import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateSections() {
  try {
    console.log('🔄 Migrating exam section names...\n')

    // Mapping of old names to new names
    const sectionMapping: Record<string, string> = {
      'BIBLE': 'BIBLE_STUDIES',
      'CHURCH_HISTORY': 'CHURCH_HISTORY_COPTIC_HERITAGE',
      'SACRAMENTS': 'RITUAL_THEOLOGY_SACRAMENTS',
      // DOGMA stays the same
      // COMPARATIVE_THEOLOGY stays the same
      // PSYCHOLOGY_METHODOLOGY stays the same
    }

    // Get all exam sections
    const sections = await prisma.$queryRaw<any[]>`
      SELECT * FROM "ExamSection"
    `

    console.log(`Found ${sections.length} exam sections\n`)

    // Update each section that needs migration
    for (const section of sections) {
      const oldName = section.name
      const newName = sectionMapping[oldName] || oldName

      if (oldName !== newName) {
        console.log(`Updating: ${oldName} → ${newName}`)

        await prisma.$executeRaw`
          UPDATE "ExamSection"
          SET name = ${newName}::text::"ExamSectionType"
          WHERE id = ${section.id}
        `
      } else {
        console.log(`Keeping: ${oldName} (no change needed)`)
      }
    }

    console.log('\n✅ Section migration complete!')

  } catch (error) {
    console.error('❌ Error migrating sections:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

migrateSections()
