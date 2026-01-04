import * as XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const workbook = XLSX.readFile('_temp/Attendance 2024-25.xlsx')

// Helper to convert Excel serial date to JS Date
function excelDateToJS(serial: number): Date {
  const utc_days = Math.floor(serial - 25569)
  const date = new Date(utc_days * 86400 * 1000)
  return date
}

// Normalize name for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Manual name mappings for known mismatches
const manualNameMappings: { [key: string]: string } = {
  'mivel abdelmalek': 'mivel abdelmalak',
  'youssef shehata': 'youssef shahata',
  'kero moawd': 'kerlos moawd',
}

async function main() {
  console.log('\n========================================')
  console.log('  IMPORTING ATTENDANCE 2024-2025')
  console.log('========================================\n')

  const sheet = workbook.Sheets['Attendance (2024 - 2025)']
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

  // Parse header row to get dates
  const headerRow = data[0]
  const dates: { col: number; date: Date; dateStr: string }[] = []

  for (let i = 3; i < headerRow.length; i += 2) {
    const serial = headerRow[i]
    if (typeof serial === 'number') {
      const date = excelDateToJS(serial)
      dates.push({
        col: i,
        date,
        dateStr: date.toISOString().split('T')[0]
      })
    }
  }

  // Get students from DB
  const dbStudents = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' }
  })

  // Create normalized name map for DB students
  const dbStudentMap = new Map<string, { id: string; name: string; email: string }>()
  for (const s of dbStudents) {
    const normalized = normalizeName(s.name)
    dbStudentMap.set(normalized, s)
  }

  // Get lessons from 2024-2025
  const academicYear = await prisma.academicYear.findFirst({
    where: { name: { contains: '2024-2025' } }
  })

  if (!academicYear) {
    console.error('ERROR: Academic year 2024-2025 not found!')
    process.exit(1)
  }

  const lessons = await prisma.lesson.findMany({
    where: { academicYearId: academicYear.id },
    orderBy: { lessonNumber: 'asc' },
    select: { id: true, lessonNumber: true, title: true, scheduledDate: true }
  })

  // Create date map for lessons
  const lessonDateMap = new Map<string, { id: string; lessonNumber: number; title: string }>()
  for (const l of lessons) {
    const dateStr = l.scheduledDate.toISOString().split('T')[0]
    lessonDateMap.set(dateStr, { id: l.id, lessonNumber: l.lessonNumber, title: l.title })
  }

  // Match Excel dates to lessons
  const dateMatches: { excelDate: string; lesson: { id: string; lessonNumber: number; title: string } | null; col: number }[] = []

  for (const d of dates) {
    const lesson = lessonDateMap.get(d.dateStr)
    if (lesson) {
      dateMatches.push({ excelDate: d.dateStr, lesson, col: d.col })
    }
  }

  console.log(`Matched ${dateMatches.length} dates to lessons\n`)

  // Parse and import attendance
  let totalCreated = 0
  let totalSkipped = 0
  let studentsProcessed = 0

  // Skip header rows (row 0 and 1)
  for (let rowIdx = 2; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx]
    if (!row || !row[1]) continue

    const excelName = row[1]?.toString().trim()
    if (!excelName || excelName === '') continue

    // Try to match to DB student
    const normalizedExcelName = normalizeName(excelName)
    const mappedName = manualNameMappings[normalizedExcelName] || normalizedExcelName
    const dbStudent = dbStudentMap.get(mappedName)

    if (!dbStudent) continue // Skip unmatched students

    studentsProcessed++
    let studentCreated = 0
    let studentSkipped = 0

    // Import attendance for each matched date
    for (const dm of dateMatches) {
      if (!dm.lesson) continue

      const presentVal = row[dm.col]
      const lateVal = row[dm.col + 1]

      const present = presentVal === true || presentVal === 1 || presentVal === 'TRUE'
      const late = lateVal === true || lateVal === 1 || lateVal === 'TRUE'

      // Determine status
      let status: 'PRESENT' | 'LATE' | 'ABSENT'
      if (present) {
        status = late ? 'LATE' : 'PRESENT'
      } else {
        status = 'ABSENT'
      }

      // Check if record already exists
      const existing = await prisma.attendanceRecord.findFirst({
        where: {
          lessonId: dm.lesson.id,
          studentId: dbStudent.id
        }
      })

      if (existing) {
        studentSkipped++
        continue
      }

      // Create attendance record
      await prisma.attendanceRecord.create({
        data: {
          lessonId: dm.lesson.id,
          studentId: dbStudent.id,
          status,
          arrivedAt: status === 'LATE' ? new Date() : null
        }
      })

      studentCreated++
    }

    console.log(`  ${dbStudent.name}: ${studentCreated} created, ${studentSkipped} skipped`)
    totalCreated += studentCreated
    totalSkipped += studentSkipped
  }

  console.log('\n========================================')
  console.log('  IMPORT COMPLETE')
  console.log('========================================\n')
  console.log(`Students processed: ${studentsProcessed}`)
  console.log(`Records created: ${totalCreated}`)
  console.log(`Records skipped: ${totalSkipped}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
