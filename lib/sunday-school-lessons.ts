import type { Prisma } from "@prisma/client"
import { prisma } from "./prisma"
import { normalizeSessionDate } from "./sunday-school-class"

export const SUNDAY_SCHOOL_LESSON_WINDOW_WEEKS = 8

export type SundaySchoolWeeklyLessonStatus = "UNASSIGNED" | "NEEDS_LINKS" | "READY"

export interface SundaySchoolLessonResourceInput {
  title: string
  url: string
}

type LessonDatabase = Pick<
  Prisma.TransactionClient,
  "sundaySchoolClass" | "sundaySchoolWeeklyLesson"
>

export function getUpcomingSundays(
  from: Date = new Date(),
  count = SUNDAY_SCHOOL_LESSON_WINDOW_WEEKS
): Date[] {
  const start = normalizeSessionDate(from)
  const daysUntilSunday = (7 - start.getUTCDay()) % 7
  start.setUTCDate(start.getUTCDate() + daysUntilSunday)

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index * 7)
    return date
  })
}

export function getSundaysInRange(startDate: Date, endDate: Date): Date[] {
  const end = normalizeSessionDate(endDate)
  const firstSunday = getUpcomingSundays(startDate, 1)[0]
  const sundays: Date[] = []
  for (const date = new Date(firstSunday); date <= end; date.setUTCDate(date.getUTCDate() + 7)) {
    sundays.push(new Date(date))
  }
  return sundays
}

export function getWeeklyLessonStatus(
  ownerId: string | null,
  resourceCount: number
): SundaySchoolWeeklyLessonStatus {
  if (!ownerId) return "UNASSIGNED"
  if (resourceCount === 0) return "NEEDS_LINKS"
  return "READY"
}

export function validateWeeklyLessonResources(value: unknown):
  | { ok: true; resources: SundaySchoolLessonResourceInput[] }
  | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: "Resources must be an array" }
  }

  const resources: SundaySchoolLessonResourceInput[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Each resource needs a title and URL" }
    }

    const candidate = item as { title?: unknown; url?: unknown }
    const title = typeof candidate.title === "string" ? candidate.title.trim() : ""
    const url = typeof candidate.url === "string" ? candidate.url.trim() : ""
    if (!title || !url) {
      return { ok: false, error: "Each resource needs a title and URL" }
    }

    try {
      const parsed = new URL(url)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "Resource URLs must start with http:// or https://" }
      }
    } catch {
      return { ok: false, error: "Enter a valid resource URL" }
    }

    resources.push({ title, url })
  }

  return { ok: true, resources }
}

export async function ensureSundaySchoolWeeklyLessons({
  classIds,
  db = prisma,
}: {
  classIds?: string[]
  db?: LessonDatabase
} = {}) {
  const classes = await db.sundaySchoolClass.findMany({
    where: {
      isActive: true,
      academicYear: { isActive: true },
      ...(classIds ? { id: { in: classIds } } : {}),
    },
    select: {
      id: true,
      academicYear: { select: { startDate: true, endDate: true } },
    },
  })

  const rows = classes.flatMap((cls) => {
    const yearStart = normalizeSessionDate(cls.academicYear.startDate)
    const yearEnd = normalizeSessionDate(cls.academicYear.endDate)
    return getSundaysInRange(yearStart, yearEnd)
      .map((sundayDate) => ({ classId: cls.id, sundayDate }))
  })

  if (rows.length === 0) {
    return { classes: classes.length, attempted: 0, created: 0 }
  }

  const result = await db.sundaySchoolWeeklyLesson.createMany({
    data: rows,
    skipDuplicates: true,
  })

  return { classes: classes.length, attempted: rows.length, created: result.count }
}
