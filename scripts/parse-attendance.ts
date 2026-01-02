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

// Calculate similarity between two strings (Levenshtein distance based)
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1

  if (longer.length === 0) return 1.0

  const costs: number[] = []
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else if (j > 0) {
        let newValue = costs[j - 1]
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
        }
        costs[j - 1] = lastValue
        lastValue = newValue
      }
    }
    if (i > 0) costs[s2.length] = lastValue
  }

  return (longer.length - costs[s2.length]) / longer.length
}

// Manual name mappings for known mismatches
const manualNameMappings: { [key: string]: string } = {
  'mivel abdelmalek': 'mivel abdelmalak',
  'youssef shehata': 'youssef shahata',
  'kero moawd': 'kerlos moawd',
}

async function main() {
  console.log('\n========================================')
  console.log('  ATTENDANCE IMPORT ANALYSIS')
  console.log('  Mapping Excel to Database')
  console.log('========================================\n')

  const sheet = workbook.Sheets['Attendance (2024 - 2025)']
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

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

  console.log(`Found ${dates.length} attendance dates in Excel\n`)

  // Get students from DB
  const dbStudents = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' }
  })

  // Create normalized name map for DB students
  const dbStudentMap = new Map<string, { id: string; name: string; email: string }>()
  const dbStudentList: { normalized: string; student: { id: string; name: string; email: string } }[] = []

  for (const s of dbStudents) {
    const normalized = normalizeName(s.name)
    dbStudentMap.set(normalized, s)
    dbStudentList.push({ normalized, student: s })
  }

  // Get lessons from 2024-2025
  const academicYear = await prisma.academicYear.findFirst({
    where: { name: { contains: '2024-2025' } }
  })

  const lessons = await prisma.lesson.findMany({
    where: { academicYearId: academicYear?.id },
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
  console.log('--- DATE MATCHING ---\n')
  let matchedDates = 0
  let unmatchedDates = 0
  const dateMatches: { excelDate: string; lesson: { id: string; lessonNumber: number; title: string } | null; col: number }[] = []

  for (const d of dates) {
    const lesson = lessonDateMap.get(d.dateStr)
    if (lesson) {
      console.log(`  ✓ ${d.dateStr} → Lesson #${lesson.lessonNumber}: ${lesson.title}`)
      matchedDates++
      dateMatches.push({ excelDate: d.dateStr, lesson, col: d.col })
    } else {
      console.log(`  ✗ ${d.dateStr} → NO MATCHING LESSON`)
      unmatchedDates++
      dateMatches.push({ excelDate: d.dateStr, lesson: null, col: d.col })
    }
  }

  console.log(`\nMatched: ${matchedDates} dates`)
  console.log(`Unmatched: ${unmatchedDates} dates`)

  // Parse student attendance from Excel
  console.log('\n--- STUDENT MATCHING ---\n')

  interface StudentAttendance {
    excelName: string
    excelYear: string | number
    dbStudent: { id: string; name: string; email: string } | null
    matchType: 'exact' | 'manual' | 'fuzzy' | 'none'
    attendance: { date: string; lessonId: string | null; present: boolean; late: boolean }[]
  }

  const studentAttendance: StudentAttendance[] = []
  let matchedStudents = 0
  let unmatchedStudents: { name: string; closestMatch: string | null; similarity: number }[] = []
  const fuzzyMatches: { excel: string; db: string; similarity: number }[] = []

  // Skip header rows (row 0 and 1)
  for (let rowIdx = 2; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx]
    if (!row || !row[1]) continue // Skip empty rows

    const excelName = row[1]?.toString().trim()
    const excelYear = row[2]

    if (!excelName || excelName === '') continue

    // Try to match to DB student
    const normalizedExcelName = normalizeName(excelName)

    // First check manual mappings
    const mappedName = manualNameMappings[normalizedExcelName] || normalizedExcelName

    let dbStudent = dbStudentMap.get(mappedName)
    let matchType: 'exact' | 'manual' | 'fuzzy' | 'none' = 'none'

    if (dbStudent) {
      matchType = mappedName !== normalizedExcelName ? 'manual' : 'exact'
    } else {
      // Try fuzzy matching
      let bestMatch: { student: { id: string; name: string; email: string }; similarity: number } | null = null

      for (const { normalized, student } of dbStudentList) {
        const sim = similarity(normalizedExcelName, normalized)
        if (sim > 0.8 && (!bestMatch || sim > bestMatch.similarity)) {
          bestMatch = { student, similarity: sim }
        }
      }

      if (bestMatch && bestMatch.similarity > 0.85) {
        dbStudent = bestMatch.student
        matchType = 'fuzzy'
        fuzzyMatches.push({
          excel: excelName,
          db: bestMatch.student.name,
          similarity: bestMatch.similarity
        })
      }
    }

    const attendanceRecords: { date: string; lessonId: string | null; present: boolean; late: boolean }[] = []

    // Parse attendance for each date
    for (const dm of dateMatches) {
      if (!dm.lesson) continue // Skip dates without matching lessons

      const presentVal = row[dm.col]
      const lateVal = row[dm.col + 1]

      // In Excel: true = present/late, false = absent/not late
      const present = presentVal === true || presentVal === 1 || presentVal === 'TRUE'
      const late = lateVal === true || lateVal === 1 || lateVal === 'TRUE'

      attendanceRecords.push({
        date: dm.excelDate,
        lessonId: dm.lesson.id,
        present,
        late
      })
    }

    studentAttendance.push({
      excelName,
      excelYear,
      dbStudent: dbStudent || null,
      matchType,
      attendance: attendanceRecords
    })

    if (dbStudent) {
      matchedStudents++
    } else {
      // Find closest match for reporting
      let closestMatch: string | null = null
      let closestSim = 0

      for (const { normalized, student } of dbStudentList) {
        const sim = similarity(normalizedExcelName, normalized)
        if (sim > closestSim) {
          closestSim = sim
          closestMatch = student.name
        }
      }

      unmatchedStudents.push({ name: excelName, closestMatch, similarity: closestSim })
    }
  }

  console.log(`Matched: ${matchedStudents} students`)
  console.log(`Unmatched: ${unmatchedStudents.length} students\n`)

  // Show manual mappings used
  const manualMatches = studentAttendance.filter(s => s.matchType === 'manual')
  if (manualMatches.length > 0) {
    console.log('--- MANUAL MAPPINGS APPLIED ---')
    manualMatches.forEach(s => {
      console.log(`  ✓ "${s.excelName}" → "${s.dbStudent?.name}"`)
    })
    console.log('')
  }

  // Show fuzzy matches
  if (fuzzyMatches.length > 0) {
    console.log('--- FUZZY MATCHES (auto-detected) ---')
    fuzzyMatches.forEach(m => {
      console.log(`  ✓ "${m.excel}" → "${m.db}" (${(m.similarity * 100).toFixed(0)}% match)`)
    })
    console.log('')
  }

  if (unmatchedStudents.length > 0) {
    console.log('--- UNMATCHED STUDENTS (need manual mapping or not in DB) ---')
    unmatchedStudents.forEach(u => {
      console.log(`  ✗ "${u.name}"`)
      if (u.closestMatch && u.similarity > 0.5) {
        console.log(`      Closest: "${u.closestMatch}" (${(u.similarity * 100).toFixed(0)}% similar)`)
      }
    })
    console.log('')
  }

  // Summarize what will be imported
  console.log('\n========================================')
  console.log('  IMPORT PREVIEW')
  console.log('========================================\n')

  let totalRecords = 0
  let presentCount = 0
  let lateCount = 0
  let absentCount = 0

  const matchedStudentData = studentAttendance.filter(s => s.dbStudent)

  for (const s of matchedStudentData) {
    for (const a of s.attendance) {
      if (a.lessonId) {
        totalRecords++
        if (a.present) {
          if (a.late) {
            lateCount++
          } else {
            presentCount++
          }
        } else {
          absentCount++
        }
      }
    }
  }

  console.log(`Students to import: ${matchedStudentData.length}`)
  console.log(`Lessons with dates matched: ${matchedDates}`)
  console.log(`Total attendance records: ${totalRecords}`)
  console.log(`  - Present: ${presentCount}`)
  console.log(`  - Late: ${lateCount}`)
  console.log(`  - Absent: ${absentCount}`)

  // Show ALL students that will be imported
  console.log('\n--- ALL STUDENTS TO IMPORT ---\n')

  for (const s of matchedStudentData) {
    const presentLessons = s.attendance.filter(a => a.present && !a.late && a.lessonId).length
    const lateLessons = s.attendance.filter(a => a.late && a.lessonId).length
    const absentLessons = s.attendance.filter(a => !a.present && a.lessonId).length
    const matchIndicator = s.matchType === 'exact' ? '' : s.matchType === 'manual' ? ' [MANUAL]' : ' [FUZZY]'

    console.log(`${s.dbStudent?.name}${matchIndicator} (Year ${s.excelYear})`)
    console.log(`  Present: ${presentLessons}, Late: ${lateLessons}, Absent: ${absentLessons}`)
  }

  // Check for existing attendance records
  const existingRecords = await prisma.attendanceRecord.count({
    where: {
      lesson: { academicYearId: academicYear?.id }
    }
  })

  console.log('\n--- EXISTING DATA CHECK ---\n')
  console.log(`Existing attendance records for 2024-2025: ${existingRecords}`)

  if (existingRecords > 0) {
    console.log('\n⚠️  WARNING: There are existing attendance records.')
    console.log('   Import will skip duplicates (same student + lesson).')
  }

  await prisma.$disconnect()
}

main().catch(console.error)
