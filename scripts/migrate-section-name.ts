import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Migrating SPIRITUALITY_OF_MENTOR to SPIRITUALITY_OF_SERVANT...')

  // First, we need to run raw SQL to:
  // 1. Add the new enum values
  // 2. Update all records using the old value
  // 3. Remove the old enum value

  try {
    // Step 1: Add new enum values (SPIRITUALITY_OF_SERVANT and MISCELLANEOUS)
    console.log('Adding new enum values...')
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "ExamSectionType" ADD VALUE IF NOT EXISTS 'SPIRITUALITY_OF_SERVANT';
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "ExamSectionType" ADD VALUE IF NOT EXISTS 'MISCELLANEOUS';
    `)
    console.log('New enum values added successfully')

    // Step 2: Update ExamSection records
    console.log('Updating ExamSection records...')
    const updatedSections = await prisma.$executeRawUnsafe(`
      UPDATE "ExamSection"
      SET "name" = 'SPIRITUALITY_OF_SERVANT'::"ExamSectionType",
          "displayName" = 'Spirituality of the Servant'
      WHERE "name" = 'SPIRITUALITY_OF_MENTOR'::"ExamSectionType"
    `)
    console.log(`Updated ${updatedSections} ExamSection records`)

    // Step 3: Create Miscellaneous section if it doesn't exist
    console.log('Creating Miscellaneous section if needed...')
    const existingMisc = await prisma.examSection.findFirst({
      where: { name: 'MISCELLANEOUS' as any }
    })

    if (!existingMisc) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "ExamSection" ("id", "name", "displayName", "passingScore", "averageRequirement")
        VALUES (gen_random_uuid()::text, 'MISCELLANEOUS'::"ExamSectionType", 'Miscellaneous', 60, 75)
        ON CONFLICT ("name") DO NOTHING
      `)
      console.log('Miscellaneous section created')
    } else {
      console.log('Miscellaneous section already exists')
    }

    console.log('Migration completed successfully!')
    console.log('')
    console.log('IMPORTANT: Now you need to run the schema push to finalize:')
    console.log('1. The old enum value is no longer in use')
    console.log('2. Run: bun db:push --accept-data-loss')
    console.log('')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
