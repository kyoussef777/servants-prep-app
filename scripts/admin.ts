/**
 * Admin CLI Tool for Servants Prep App
 *
 * Usage: bun scripts/admin.ts <command> [options]
 *
 * Commands:
 *   reset-password <email>     Reset a user's password to a new secure random password
 *   create-admin <email>       Create a new SUPER_ADMIN user
 *   list-admins                List all admin users (SUPER_ADMIN, PRIEST, SERVANT_PREP)
 *   list-sections              List all exam sections
 *   db-stats                   Show database statistics
 */

import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient({
  datasourceUrl: process.env.SP_DATABASE_URL_UNPOOLED || process.env.SP_DATABASE_URL
})

// Generate a secure random password
function generateSecurePassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*_+-='
  const allChars = uppercase + lowercase + numbers + symbols

  let password = ''
  password += uppercase[crypto.randomInt(0, uppercase.length)]
  password += lowercase[crypto.randomInt(0, lowercase.length)]
  password += numbers[crypto.randomInt(0, numbers.length)]
  password += symbols[crypto.randomInt(0, symbols.length)]

  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(0, allChars.length)]
  }

  return password.split('').sort(() => crypto.randomInt(-1, 2)).join('')
}

async function resetPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    console.error(`❌ User with email "${email}" not found`)
    process.exit(1)
  }

  const newPassword = generateSecurePassword(20)
  const hashedPassword = await bcrypt.hash(newPassword, 10)

  await prisma.user.update({
    where: { email },
    data: {
      password: hashedPassword,
      mustChangePassword: false
    }
  })

  console.log('\n✅ Password reset successfully!\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📧 Email:    ${email}`)
  console.log(`👤 Name:     ${user.name}`)
  console.log(`🔑 Password: ${newPassword}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n⚠️  Save this password securely!\n')
}

async function createAdmin(email: string, name?: string) {
  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    console.error(`❌ User with email "${email}" already exists`)
    process.exit(1)
  }

  const newPassword = generateSecurePassword(20)
  const hashedPassword = await bcrypt.hash(newPassword, 10)

  const user = await prisma.user.create({
    data: {
      email,
      name: name || 'Administrator',
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,
      mustChangePassword: false
    }
  })

  console.log('\n✅ Super Admin created successfully!\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📧 Email:    ${email}`)
  console.log(`👤 Name:     ${user.name}`)
  console.log(`🔑 Password: ${newPassword}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n⚠️  Save this password securely!\n')
}

async function listAdmins() {
  const admins = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.SUPER_ADMIN, UserRole.PRIEST, UserRole.SERVANT_PREP] }
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { role: 'asc' }
  })

  console.log('\n📋 Admin Users:\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (admins.length === 0) {
    console.log('  No admin users found.')
  } else {
    admins.forEach((admin, i) => {
      console.log(`  ${i + 1}. ${admin.name}`)
      console.log(`     Email: ${admin.email}`)
      console.log(`     Role:  ${admin.role}`)
      console.log(`     Created: ${admin.createdAt.toLocaleDateString()}`)
      console.log('')
    })
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

async function listSections() {
  const sections = await prisma.examSection.findMany({
    orderBy: { name: 'asc' }
  })

  console.log('\n📚 Exam Sections:\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (sections.length === 0) {
    console.log('  No exam sections found. Run `bun db:seed` to create them.')
  } else {
    sections.forEach((section, i) => {
      console.log(`  ${i + 1}. ${section.displayName}`)
      console.log(`     Name: ${section.name}`)
      console.log(`     Passing Score: ${section.passingScore}%`)
      console.log(`     Average Requirement: ${section.averageRequirement}%`)
      console.log('')
    })
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

async function dbStats() {
  const [
    userCount,
    studentCount,
    mentorCount,
    adminCount,
    enrollmentCount,
    lessonCount,
    examCount,
    attendanceCount,
    sectionCount,
    academicYearCount
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: UserRole.STUDENT } }),
    prisma.user.count({ where: { role: UserRole.MENTOR } }),
    prisma.user.count({ where: { role: { in: [UserRole.SUPER_ADMIN, UserRole.PRIEST, UserRole.SERVANT_PREP] } } }),
    prisma.studentEnrollment.count(),
    prisma.lesson.count(),
    prisma.exam.count(),
    prisma.attendanceRecord.count(),
    prisma.examSection.count(),
    prisma.academicYear.count()
  ])

  const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })

  console.log('\n📊 Database Statistics:\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Users:             ${userCount}`)
  console.log(`    - Students:      ${studentCount}`)
  console.log(`    - Mentors:       ${mentorCount}`)
  console.log(`    - Admins:        ${adminCount}`)
  console.log('')
  console.log(`  Enrollments:       ${enrollmentCount}`)
  console.log(`  Lessons:           ${lessonCount}`)
  console.log(`  Exams:             ${examCount}`)
  console.log(`  Attendance Records: ${attendanceCount}`)
  console.log(`  Exam Sections:     ${sectionCount}`)
  console.log(`  Academic Years:    ${academicYearCount}`)
  console.log('')
  console.log(`  Active Year:       ${activeYear?.name || 'None'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

function showHelp() {
  console.log(`
Admin CLI Tool for Servants Prep App

Usage: bun scripts/admin.ts <command> [options]

Commands:
  reset-password <email>       Reset a user's password to a new secure random password
  create-admin <email> [name]  Create a new SUPER_ADMIN user
  list-admins                  List all admin users (SUPER_ADMIN, PRIEST, SERVANT_PREP)
  list-sections                List all exam sections
  db-stats                     Show database statistics
  help                         Show this help message

Examples:
  bun scripts/admin.ts reset-password user@example.com
  bun scripts/admin.ts create-admin newadmin@church.com "Fr. John"
  bun scripts/admin.ts list-admins
  bun scripts/admin.ts db-stats
`)
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp()
    return
  }

  console.log('🔌 Connecting to database...')
  await prisma.$connect()
  console.log('✅ Connected!\n')

  switch (command) {
    case 'reset-password':
      if (!args[1]) {
        console.error('❌ Email is required. Usage: bun scripts/admin.ts reset-password <email>')
        process.exit(1)
      }
      await resetPassword(args[1])
      break

    case 'create-admin':
      if (!args[1]) {
        console.error('❌ Email is required. Usage: bun scripts/admin.ts create-admin <email> [name]')
        process.exit(1)
      }
      await createAdmin(args[1], args[2])
      break

    case 'list-admins':
      await listAdmins()
      break

    case 'list-sections':
      await listSections()
      break

    case 'db-stats':
      await dbStats()
      break

    default:
      console.error(`❌ Unknown command: ${command}`)
      showHelp()
      process.exit(1)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error:', e.message || e)
    await prisma.$disconnect()
    process.exit(1)
  })
