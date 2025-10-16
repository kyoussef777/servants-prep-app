import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Renaming SERVANT role to MENTOR...\n')

  try {
    // Step 1: Add new enum value MENTOR to UserRole
    console.log('Step 1: Adding MENTOR value to UserRole enum...')
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MENTOR';
    `)
    console.log('✓ Added MENTOR to UserRole enum')

    // Step 2: Update all users with SERVANT role to MENTOR
    console.log('\nStep 2: Updating users from SERVANT to MENTOR...')
    const result = await prisma.$executeRawUnsafe(`
      UPDATE "User" SET role = 'MENTOR' WHERE role = 'SERVANT';
    `)
    console.log(`✓ Updated ${result} users from SERVANT to MENTOR`)

    // Step 3: Update ExamSection enum
    console.log('\nStep 3: Adding SPIRITUALITY_OF_MENTOR to ExamSectionType enum...')
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "ExamSectionType" ADD VALUE IF NOT EXISTS 'SPIRITUALITY_OF_MENTOR';
    `)
    console.log('✓ Added SPIRITUALITY_OF_MENTOR to ExamSectionType enum')

    // Step 4: Update ExamSection records
    console.log('\nStep 4: Updating exam sections from SPIRITUALITY_OF_SERVANT to SPIRITUALITY_OF_MENTOR...')
    const sectionResult = await prisma.$executeRawUnsafe(`
      UPDATE "ExamSection"
      SET name = 'SPIRITUALITY_OF_MENTOR', "displayName" = 'The Spirituality of the Mentor'
      WHERE name = 'SPIRITUALITY_OF_SERVANT';
    `)
    console.log(`✓ Updated ${sectionResult} exam section(s)`)

    console.log('\n✅ Successfully renamed SERVANT to MENTOR!')
    console.log('\nNote: The old enum values (SERVANT, SPIRITUALITY_OF_SERVANT) still exist')
    console.log('but are no longer used. They cannot be removed without recreating the enum.')

  } catch (error) {
    console.error('\n❌ Error during migration:', error)
    throw error
  }
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
