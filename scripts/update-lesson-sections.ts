import { PrismaClient, ExamSectionType } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

async function main() {
  console.log('Reading Excel file...')

  const workbook = XLSX.readFile('/Users/kyoussef/Documents/servants-prep-app/SP_ Speaker & Topic Schedule (2023-Present).xlsx')
  const sheetName = workbook.SheetNames.find(name => name.includes('2025-26') || name.includes('2025-2026'))

  if (!sheetName) {
    throw new Error('Could not find 2025-26 sheet')
  }

  console.log(`Found sheet: ${sheetName}`)
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet)

  console.log(`Found ${data.length} rows`)

  // Get all sections
  const sections = await prisma.examSection.findMany()
  const sectionMap: Record<string, any> = {}
  sections.forEach(section => {
    sectionMap[section.name] = section
  })

  console.log('Available sections:', Object.keys(sectionMap))

  // Get academic year
  const academicYear = await prisma.academicYear.findFirst({
    where: { name: '2025-2026' }
  })

  if (!academicYear) {
    throw new Error('Academic year 2025-2026 not found')
  }

  // Get all lessons for this academic year
  const lessons = await prisma.lesson.findMany({
    where: { academicYearId: academicYear.id },
    orderBy: { scheduledDate: 'asc' }
  })

  console.log(`Found ${lessons.length} lessons to update`)

  let updateCount = 0
  let lessonIndex = 0
  let currentTheme = 'Introduction to the Bible' // Start with first theme

  // Process each row and update lessons by index
  for (let i = 0; i < data.length; i++) {
    const row: any = data[i]

    const topic = row['Topic']?.toString().trim() || ''
    const dateValue = row['Date']
    const meetingNo = row['Meeting No.']

    // Update current theme if this row has one
    if (row['Theme'] && row['Theme'].toString().trim()) {
      currentTheme = row['Theme'].toString().trim()
    }

    // Skip rows without topic, date, or with "-" as meeting number
    if (!topic || topic === '-' || !dateValue || meetingNo === '-') {
      continue
    }

    // Determine section based on current theme
    let sectionId = sectionMap['BIBLE']?.id
    const themeLower = currentTheme.toLowerCase()

    if (themeLower.includes('dogma')) {
      sectionId = sectionMap['DOGMA']?.id
    } else if (themeLower.includes('church') || themeLower.includes('history')) {
      sectionId = sectionMap['CHURCH_HISTORY']?.id
    } else if (themeLower.includes('comparative') || themeLower.includes('theology')) {
      sectionId = sectionMap['COMPARATIVE_THEOLOGY']?.id
    } else if (themeLower.includes('psychology') || themeLower.includes('methodology')) {
      sectionId = sectionMap['PSYCHOLOGY_METHODOLOGY']?.id
    } else if (themeLower.includes('sacrament')) {
      sectionId = sectionMap['SACRAMENTS']?.id
    } else if (themeLower.includes('bible') || themeLower.includes('testament') || themeLower.includes('introduction')) {
      sectionId = sectionMap['BIBLE']?.id
    }

    const sectionName = Object.keys(sectionMap).find(key => sectionMap[key].id === sectionId)

    // Get lesson by index
    const lesson = lessons[lessonIndex]

    if (lesson) {
      console.log(`Row ${i+1} (Meeting ${meetingNo}): Theme="${currentTheme}" → ${sectionName}`)
      console.log(`  Updating lesson ${lesson.lessonNumber}: "${lesson.title}"`)

      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { examSectionId: sectionId }
      })

      updateCount++
      lessonIndex++
    } else {
      console.log(`⚠️  No more lessons to update (row ${i+1})`)
      break
    }
  }

  console.log(`\n✅ Updated ${updateCount} lessons`)
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
