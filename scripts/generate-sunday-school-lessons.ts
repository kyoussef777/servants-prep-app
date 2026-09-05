import { prisma } from '../lib/prisma'
import { ensureSundaySchoolWeeklyLessons } from '../lib/sunday-school-lessons'

async function main() {
  const result = await ensureSundaySchoolWeeklyLessons()
  console.log(JSON.stringify(result))
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
