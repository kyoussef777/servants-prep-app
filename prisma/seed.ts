import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // Create exam sections
  console.log('Creating exam sections...')
  const examSections = await Promise.all([
    prisma.examSection.upsert({
      where: { name: 'BIBLE_STUDIES' },
      update: { displayName: 'Bible Studies' },
      create: {
        name: 'BIBLE_STUDIES',
        displayName: 'Bible Studies',
        passingScore: 60,
        averageRequirement: 75,
      },
    }),
    prisma.examSection.upsert({
      where: { name: 'DOGMA' },
      update: { displayName: 'Dogma' },
      create: {
        name: 'DOGMA',
        displayName: 'Dogma',
        passingScore: 60,
        averageRequirement: 75,
      },
    }),
    prisma.examSection.upsert({
      where: { name: 'COMPARATIVE_THEOLOGY' },
      update: { displayName: 'Comparative Theology' },
      create: {
        name: 'COMPARATIVE_THEOLOGY',
        displayName: 'Comparative Theology',
        passingScore: 60,
        averageRequirement: 75,
      },
    }),
    prisma.examSection.upsert({
      where: { name: 'RITUAL_THEOLOGY_SACRAMENTS' },
      update: { displayName: 'Ritual Theology & Sacraments' },
      create: {
        name: 'RITUAL_THEOLOGY_SACRAMENTS',
        displayName: 'Ritual Theology & Sacraments',
        passingScore: 60,
        averageRequirement: 75,
      },
    }),
    prisma.examSection.upsert({
      where: { name: 'CHURCH_HISTORY_COPTIC_HERITAGE' },
      update: { displayName: 'Church History & Coptic Heritage' },
      create: {
        name: 'CHURCH_HISTORY_COPTIC_HERITAGE',
        displayName: 'Church History & Coptic Heritage',
        passingScore: 60,
        averageRequirement: 75,
      },
    }),
    prisma.examSection.upsert({
      where: { name: 'SPIRITUALITY_OF_SERVANT' },
      update: { displayName: 'Spirituality of the Servant' },
      create: {
        name: 'SPIRITUALITY_OF_SERVANT',
        displayName: 'Spirituality of the Servant',
        passingScore: 60,
        averageRequirement: 75,
      },
    }),
    prisma.examSection.upsert({
      where: { name: 'PSYCHOLOGY_METHODOLOGY' },
      update: { displayName: 'Psychology & Methodology' },
      create: {
        name: 'PSYCHOLOGY_METHODOLOGY',
        displayName: 'Psychology & Methodology',
        passingScore: 60,
        averageRequirement: 75,
      },
    }),
    prisma.examSection.upsert({
      where: { name: 'MISCELLANEOUS' },
      update: { displayName: 'Miscellaneous' },
      create: {
        name: 'MISCELLANEOUS',
        displayName: 'Miscellaneous',
        passingScore: 60,
        averageRequirement: 75,
      },
    }),
  ])

  console.log('Exam sections created:', examSections.length)

  // Create users
  console.log('Creating users...')
  const hashedPassword = await bcrypt.hash('password123', 10)

  const priest = await prisma.user.upsert({
    where: { email: 'priest@church.com' },
    update: {},
    create: {
      email: 'priest@church.com',
      name: 'Fr. Michael',
      password: hashedPassword,
      role: 'PRIEST',
    },
  })

  const mentor1 = await prisma.user.upsert({
    where: { email: 'mentor1@church.com' },
    update: {},
    create: {
      email: 'mentor1@church.com',
      name: 'Abouna Peter',
      password: hashedPassword,
      role: 'MENTOR',
    },
  })

  const mentor2 = await prisma.user.upsert({
    where: { email: 'mentor2@church.com' },
    update: {},
    create: {
      email: 'mentor2@church.com',
      name: 'Abouna John',
      password: hashedPassword,
      role: 'MENTOR',
    },
  })

  const student1 = await prisma.user.upsert({
    where: { email: 'student1@church.com' },
    update: {},
    create: {
      email: 'student1@church.com',
      name: 'John Smith',
      password: hashedPassword,
      role: 'STUDENT',
    },
  })

  const student2 = await prisma.user.upsert({
    where: { email: 'student2@church.com' },
    update: {},
    create: {
      email: 'student2@church.com',
      name: 'Mary Jones',
      password: hashedPassword,
      role: 'STUDENT',
    },
  })

  const student3 = await prisma.user.upsert({
    where: { email: 'student3@church.com' },
    update: {},
    create: {
      email: 'student3@church.com',
      name: 'Peter David',
      password: hashedPassword,
      role: 'STUDENT',
    },
  })

  console.log('Users created')

  // Create academic year
  console.log('Creating academic year...')
  const academicYear = await prisma.academicYear.upsert({
    where: { name: '2024-2025' },
    update: {},
    create: {
      name: '2024-2025',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-06-30'),
      isActive: true,
    },
  })

  console.log('Academic year created:', academicYear.name)

  // Create enrollments
  console.log('Creating enrollments...')
  await prisma.studentEnrollment.upsert({
    where: {
      studentId: student1.id,
    },
    update: {},
    create: {
      studentId: student1.id,
      yearLevel: 'YEAR_1',
      mentorId: mentor1.id,
      isActive: true,
    },
  })

  await prisma.studentEnrollment.upsert({
    where: {
      studentId: student2.id,
    },
    update: {},
    create: {
      studentId: student2.id,
      yearLevel: 'YEAR_2',
      mentorId: mentor1.id,
      isActive: true,
    },
  })

  await prisma.studentEnrollment.upsert({
    where: {
      studentId: student3.id,
    },
    update: {},
    create: {
      studentId: student3.id,
      yearLevel: 'YEAR_1',
      mentorId: mentor2.id,
      isActive: true,
    },
  })

  console.log('Enrollments created')

  // Create sample lessons
  console.log('Creating sample lessons...')
  const bibleSection = examSections.find(s => s.name === 'BIBLE_STUDIES')!

  const lessons = [
    {
      title: 'Creation Story - Genesis 1',
      description: 'Study of the creation account in Genesis chapter 1',
      scheduledDate: new Date('2024-09-06T19:00:00'),
      lessonNumber: 1,
    },
    {
      title: 'The Fall - Genesis 3',
      description: 'Understanding the fall of man and its consequences',
      scheduledDate: new Date('2024-09-13T19:00:00'),
      lessonNumber: 2,
    },
    {
      title: 'Noah\'s Ark - Genesis 6-9',
      description: 'The story of Noah and the great flood',
      scheduledDate: new Date('2024-09-20T19:00:00'),
      lessonNumber: 3,
    },
  ]

  for (const lesson of lessons) {
    await prisma.lesson.upsert({
      where: {
        academicYearId_lessonNumber: {
          academicYearId: academicYear.id,
          lessonNumber: lesson.lessonNumber,
        },
      },
      update: {},
      create: {
        ...lesson,
        academicYearId: academicYear.id,
        examSectionId: bibleSection.id,
        createdBy: priest.id,
        status: 'COMPLETED',
      },
    })
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
