import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { handleApiError } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { canAssignWeeklyLessonOwner, getSundaySchoolAccess } from '@/lib/sunday-school-access'
import { normalizeSessionDate } from '@/lib/sunday-school-class'
import {
  normalizeLessonDate,
  type SundaySchoolLessonCsvRow,
  validateSundaySchoolLessonRow,
} from '@/lib/sunday-school-lesson-csv'

const MAX_IMPORT_ROWS = 150

function normalizeRows(value: unknown): SundaySchoolLessonCsvRow[] | null {
  if (!Array.isArray(value)) return null
  return value.map((item, index) => {
    const row = item && typeof item === 'object' && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {}
    const resources = Array.isArray(row.resources)
      ? row.resources.flatMap(resource => {
          if (!resource || typeof resource !== 'object' || Array.isArray(resource)) return []
          const candidate = resource as Record<string, unknown>
          const title = typeof candidate.title === 'string' ? candidate.title.trim() : ''
          const url = typeof candidate.url === 'string' ? candidate.url.trim() : ''
          return [{ title, url }]
        })
      : []
    const rawDate = typeof row.lessonDate === 'string' ? row.lessonDate.trim() : ''

    return {
      rowNumber: Number.isInteger(row.rowNumber) && Number(row.rowNumber) > 1
        ? Number(row.rowNumber)
        : index + 2,
      lessonDate: normalizeLessonDate(rawDate) ?? rawDate,
      title: typeof row.title === 'string' ? row.title.trim() : '',
      resources,
      replaceResources: row.replaceResources === true,
    }
  })
}

// POST /api/sunday-school/lesson-imports
// Updates the generated lesson schedule for one class from a CSV preview.
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const classId = typeof body.classId === 'string' ? body.classId.trim() : ''
    const rows = normalizeRows(body.rows)

    if (!classId) {
      return NextResponse.json({ error: 'Choose a grade or class before importing' }, { status: 400 })
    }
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'The CSV must contain at least one lesson' }, { status: 400 })
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json({ error: `Import up to ${MAX_IMPORT_ROWS} lessons at a time` }, { status: 400 })
    }

    const targetClass = await prisma.sundaySchoolClass.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
        level: true,
        academicYearId: true,
        isActive: true,
        academicYear: { select: { startDate: true, endDate: true } },
      },
    })
    if (!targetClass || !targetClass.isActive) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    const access = await getSundaySchoolAccess(user, targetClass.academicYearId)
    if (!canAssignWeeklyLessonOwner(access, classId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const errors = rows.flatMap(validateSundaySchoolLessonRow)
    const seenDates = new Set<string>()
    const academicYearStart = normalizeSessionDate(targetClass.academicYear.startDate)
    const academicYearEnd = normalizeSessionDate(targetClass.academicYear.endDate)
    for (const row of rows) {
      if (seenDates.has(row.lessonDate)) {
        errors.push({ rowNumber: row.rowNumber, message: 'This date appears more than once in the CSV' })
      }
      seenDates.add(row.lessonDate)

      const date = normalizeLessonDate(row.lessonDate)
      if (!date) continue
      const lessonDate = new Date(`${date}T00:00:00.000Z`)
      if (lessonDate < academicYearStart || lessonDate > academicYearEnd) {
        errors.push({ rowNumber: row.rowNumber, message: 'Date is outside this class\'s academic year' })
      }
    }
    if (errors.length > 0) {
      return NextResponse.json({ error: 'Fix the invalid lesson rows', errors }, { status: 400 })
    }

    const lessonDates = rows.map(row => new Date(`${row.lessonDate}T00:00:00.000Z`))
    const existingLessons = await prisma.sundaySchoolWeeklyLesson.findMany({
      where: { classId, sundayDate: { in: lessonDates } },
      select: { id: true, sundayDate: true },
    })
    const existingDates = new Set(existingLessons.map(lesson => lesson.sundayDate.toISOString().slice(0, 10)))

    await prisma.$transaction(async tx => {
      for (const row of rows) {
        const sundayDate = new Date(`${row.lessonDate}T00:00:00.000Z`)
        const lesson = await tx.sundaySchoolWeeklyLesson.upsert({
          where: { classId_sundayDate: { classId, sundayDate } },
          create: { classId, sundayDate, title: row.title },
          update: { title: row.title },
          select: { id: true },
        })

        if (row.replaceResources) {
          await tx.sundaySchoolWeeklyLessonResource.deleteMany({
            where: { weeklyLessonId: lesson.id },
          })
          if (row.resources.length > 0) {
            await tx.sundaySchoolWeeklyLessonResource.createMany({
              data: row.resources.map((resource, sortOrder) => ({
                weeklyLessonId: lesson.id,
                title: resource.title,
                url: resource.url,
                sortOrder,
              })),
            })
          }
        }
      }
    })

    const updatedRows = rows.filter(row => existingDates.has(row.lessonDate)).length
    return NextResponse.json({
      totalRows: rows.length,
      updatedRows,
      createdRows: rows.length - updatedRows,
      classId,
      className: targetClass.name,
    }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
