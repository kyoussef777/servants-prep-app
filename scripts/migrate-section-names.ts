import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateSectionNames() {
  try {
    console.log('🔄 Starting section name migration...\n')

    // Step 1: Add new enum values first
    console.log('Step 1: Adding new enum values...')
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "ExamSectionType" ADD VALUE IF NOT EXISTS 'BIBLE_STUDIES';
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "ExamSectionType" ADD VALUE IF NOT EXISTS 'RITUAL_THEOLOGY_SACRAMENTS';
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "ExamSectionType" ADD VALUE IF NOT EXISTS 'CHURCH_HISTORY_COPTIC_HERITAGE';
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "ExamSectionType" ADD VALUE IF NOT EXISTS 'SPIRITUALITY_OF_SERVANT';
    `)
    console.log('✅ New enum values added\n')

    // Step 2: Update existing records
    console.log('Step 2: Updating existing records...')

    const bible = await prisma.$executeRawUnsafe(`
      UPDATE "ExamSection" SET name = 'BIBLE_STUDIES' WHERE name = 'BIBLE';
    `)
    console.log(`  Updated BIBLE → BIBLE_STUDIES (${bible} rows)`)

    const sacraments = await prisma.$executeRawUnsafe(`
      UPDATE "ExamSection" SET name = 'RITUAL_THEOLOGY_SACRAMENTS' WHERE name = 'SACRAMENTS';
    `)
    console.log(`  Updated SACRAMENTS → RITUAL_THEOLOGY_SACRAMENTS (${sacraments} rows)`)

    const history = await prisma.$executeRawUnsafe(`
      UPDATE "ExamSection" SET name = 'CHURCH_HISTORY_COPTIC_HERITAGE' WHERE name = 'CHURCH_HISTORY';
    `)
    console.log(`  Updated CHURCH_HISTORY → CHURCH_HISTORY_COPTIC_HERITAGE (${history} rows)`)

    console.log('\n✅ Migration complete!')
    console.log('\nYou can now run: npm run db:push --accept-data-loss')
    console.log('This will remove the old enum values and apply the full schema changes.')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

migrateSectionNames()
