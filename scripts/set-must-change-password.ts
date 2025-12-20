import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasourceUrl: process.env.SP_DATABASE_URL_UNPOOLED || process.env.SP_DATABASE_URL
})

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('❌ Email is required. Usage: bun scripts/set-must-change-password.ts <email>')
    process.exit(1)
  }

  const user = await prisma.user.update({
    where: { email },
    data: { mustChangePassword: true }
  })

  console.log('✅ Updated user:', user.email)
  console.log('   mustChangePassword:', user.mustChangePassword)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error:', e.message)
    await prisma.$disconnect()
    process.exit(1)
  })
