import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  const password = process.argv[3]

  if (!email || !password) {
    console.error('Usage: bun scripts/set-password.ts <email> <password>')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true }
  })

  if (!user) {
    // Try finding by name
    const userByName = await prisma.user.findFirst({
      where: { name: { contains: email, mode: 'insensitive' } },
      select: { id: true, name: true, email: true, role: true }
    })

    if (!userByName) {
      console.error(`User not found: ${email}`)
      process.exit(1)
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    await prisma.user.update({
      where: { id: userByName.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false
      }
    })

    console.log(`Password updated for ${userByName.name} (${userByName.email})`)
  } else {
    const hashedPassword = await bcrypt.hash(password, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false
      }
    })

    console.log(`Password updated for ${user.name} (${user.email})`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
