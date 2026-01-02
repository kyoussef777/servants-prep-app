import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function importAttendance() {
  console.log('Starting attendance import for 2025-2026...\n')

  // Read the CSV file
  const csvPath = path.join(__dirname, '../_temp/attendance-2025-2026.csv')
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const lines = csvContent.split('\n').map(line => line.trim()).filter(Boolean)

  // Parse the header row to get dates (row 1, 0-indexed)
  const dateRow = lines[0].split(',')

  // Dates start at column 8 (0-indexed), and appear every 2 columns (Attendance, Late pairs)
  const lessonDates: { date: string; colIndex: number }[] = []
  for (let i = 8; i < dateRow.length; i += 2) {
    const dateStr = dateRow[i]?.trim()
    if (dateStr && dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
      lessonDates.push({ date: dateStr, colIndex: i })
    }
  }

  console.log(`Found ${lessonDates.length} lesson dates in CSV`)

  // Get the 2025-2026 academic year
  const academicYear = await prisma.academicYear.findFirst({
    where: { name: { contains: '2025-2026' } }
  })

  if (!academicYear) {
    console.error('Academic year 2025-2026 not found!')
    return
  }

  console.log(`Academic year: ${academicYear.name} (${academicYear.id})\n`)

  // Get all lessons for this academic year
  const lessons = await prisma.lesson.findMany({
    where: { academicYearId: academicYear.id },
    orderBy: { scheduledDate: 'asc' },
    include: {
      _count: { select: { attendanceRecords: true } }
    }
  })

  console.log(`Found ${lessons.length} lessons in database\n`)

  // Create a map of date strings to lessons
  const lessonByDate = new Map<string, typeof lessons[0]>()
  for (const lesson of lessons) {
    // Format date as M/D/YY to match CSV format
    const d = new Date(lesson.scheduledDate)
    const dateStr = `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear().toString().slice(-2)}`
    lessonByDate.set(dateStr, lesson)
  }

  // Find lessons without attendance
  const lessonsNeedingAttendance = lessons.filter(l => l._count.attendanceRecords === 0)
  console.log(`Lessons needing attendance: ${lessonsNeedingAttendance.length}`)

  for (const lesson of lessonsNeedingAttendance) {
    const d = new Date(lesson.scheduledDate)
    const dateStr = `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear().toString().slice(-2)}`
    console.log(`  - L${lesson.lessonNumber}: ${lesson.title} (${dateStr})`)
  }
  console.log()

  // Get all students
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true, name: true, email: true }
  })

  console.log(`Found ${students.length} students in database\n`)

  // Create a map of student names to IDs (normalize names for matching)
  const studentByName = new Map<string, typeof students[0]>()
  for (const student of students) {
    const normalizedName = student.name.toLowerCase().trim().replace(/\s+/g, ' ')
    studentByName.set(normalizedName, student)
  }

  // Get a user to record as the attendance taker
  const adminUser = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'PRIEST', 'SERVANT_PREP'] } }
  })

  if (!adminUser) {
    console.error('No admin user found to record attendance!')
    return
  }

  // Parse student attendance data (starting from row 3, index 2)
  const attendanceToCreate: {
    lessonId: string
    studentId: string
    status: 'PRESENT' | 'LATE' | 'ABSENT'
  }[] = []

  let matchedStudents = 0
  let unmatchedStudents: string[] = []

  for (let lineIdx = 2; lineIdx < lines.length; lineIdx++) {
    const cols = lines[lineIdx].split(',')
    const studentName = cols[1]?.trim()

    if (!studentName) continue

    // Find student in database
    const normalizedName = studentName.toLowerCase().trim().replace(/\s+/g, ' ')
    const student = studentByName.get(normalizedName)

    if (!student) {
      // Try partial match
      let found = false
      for (const [name, s] of studentByName.entries()) {
        if (name.includes(normalizedName) || normalizedName.includes(name)) {
          matchedStudents++
          found = true

          // Process attendance for this student
          for (const { date, colIndex } of lessonDates) {
            const lesson = lessonByDate.get(date)
            if (!lesson) continue

            // Skip if lesson already has attendance
            if (lesson._count.attendanceRecords > 0) continue

            const attendanceVal = cols[colIndex]?.trim().toUpperCase()
            const lateVal = cols[colIndex + 1]?.trim().toUpperCase()

            let status: 'PRESENT' | 'LATE' | 'ABSENT'
            if (attendanceVal === 'TRUE') {
              status = lateVal === 'TRUE' ? 'LATE' : 'PRESENT'
            } else {
              status = 'ABSENT'
            }

            attendanceToCreate.push({
              lessonId: lesson.id,
              studentId: s.id,
              status
            })
          }
          break
        }
      }
      if (!found) {
        unmatchedStudents.push(studentName)
      }
    } else {
      matchedStudents++

      // Process attendance for this student
      for (const { date, colIndex } of lessonDates) {
        const lesson = lessonByDate.get(date)
        if (!lesson) continue

        // Skip if lesson already has attendance
        if (lesson._count.attendanceRecords > 0) continue

        const attendanceVal = cols[colIndex]?.trim().toUpperCase()
        const lateVal = cols[colIndex + 1]?.trim().toUpperCase()

        let status: 'PRESENT' | 'LATE' | 'ABSENT'
        if (attendanceVal === 'TRUE') {
          status = lateVal === 'TRUE' ? 'LATE' : 'PRESENT'
        } else {
          status = 'ABSENT'
        }

        attendanceToCreate.push({
          lessonId: lesson.id,
          studentId: student.id,
          status
        })
      }
    }
  }

  console.log(`Matched ${matchedStudents} students`)
  if (unmatchedStudents.length > 0) {
    console.log(`\nUnmatched students (${unmatchedStudents.length}):`)
    unmatchedStudents.forEach(name => console.log(`  - ${name}`))
  }

  // Group attendance by lesson for summary
  const attendanceByLesson = new Map<string, { present: number; late: number; absent: number }>()
  for (const record of attendanceToCreate) {
    if (!attendanceByLesson.has(record.lessonId)) {
      attendanceByLesson.set(record.lessonId, { present: 0, late: 0, absent: 0 })
    }
    const counts = attendanceByLesson.get(record.lessonId)!
    if (record.status === 'PRESENT') counts.present++
    else if (record.status === 'LATE') counts.late++
    else counts.absent++
  }

  console.log(`\nAttendance records to create: ${attendanceToCreate.length}`)
  console.log('\nBy lesson:')
  for (const lesson of lessonsNeedingAttendance) {
    const counts = attendanceByLesson.get(lesson.id)
    if (counts) {
      const d = new Date(lesson.scheduledDate)
      const dateStr = `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear().toString().slice(-2)}`
      console.log(`  L${lesson.lessonNumber} (${dateStr}): ${counts.present} present, ${counts.late} late, ${counts.absent} absent`)
    }
  }

  // Create attendance records in batches
  if (attendanceToCreate.length > 0) {
    console.log('\nCreating attendance records...')

    const batchSize = 100
    let created = 0

    for (let i = 0; i < attendanceToCreate.length; i += batchSize) {
      const batch = attendanceToCreate.slice(i, i + batchSize)

      await prisma.attendanceRecord.createMany({
        data: batch.map(record => ({
          ...record,
          recordedBy: adminUser.id
        })),
        skipDuplicates: true
      })

      created += batch.length
      console.log(`  Created ${created}/${attendanceToCreate.length} records...`)
    }

    console.log('\nDone!')
  } else {
    console.log('\nNo attendance records to create.')
  }
}

importAttendance()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
