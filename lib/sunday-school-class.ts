import { SundaySchoolLevel } from '@prisma/client'

/**
 * Helpers for Sunday School mode — the Sunday School class itself (classes,
 * children, weekly child attendance).
 *
 * Not to be confused with lib/sunday-school-utils.ts, which serves the
 * Servants Prep flow that verifies async students served their weeks.
 */

export const LEVEL_DISPLAY_NAMES: Record<SundaySchoolLevel, string> = {
  PRE_K: 'Pre-K',
  KINDERGARTEN: 'Kindergarten',
  GRADE_1: '1st Grade',
  GRADE_2: '2nd Grade',
  GRADE_3: '3rd Grade',
  GRADE_4: '4th Grade',
  GRADE_5: '5th Grade',
  GRADE_6: '6th Grade',
  GRADE_7: '7th Grade',
  GRADE_8: '8th Grade',
  GRADE_9: '9th Grade',
  GRADE_10: '10th Grade',
  GRADE_11: '11th Grade',
  GRADE_12: '12th Grade',
}

// Ordered Pre-K → 12th, for dropdowns and sorting class lists
export const LEVEL_ORDER: SundaySchoolLevel[] = [
  'PRE_K',
  'KINDERGARTEN',
  'GRADE_1',
  'GRADE_2',
  'GRADE_3',
  'GRADE_4',
  'GRADE_5',
  'GRADE_6',
  'GRADE_7',
  'GRADE_8',
  'GRADE_9',
  'GRADE_10',
  'GRADE_11',
  'GRADE_12',
]

export function getLevelDisplayName(level: SundaySchoolLevel): string {
  return LEVEL_DISPLAY_NAMES[level]
}

export function isValidLevel(value: unknown): value is SundaySchoolLevel {
  return typeof value === 'string' && (LEVEL_ORDER as string[]).includes(value)
}

/**
 * Sessions are identified by their date, so the time component must be
 * normalized or two entries for the same Sunday would not collide on the
 * @@unique([classId, date]) constraint.
 *
 * Normalized to midnight UTC, matching how the rest of the app stores
 * calendar days (see formatDateUTC in lib/utils.ts) — a "YYYY-MM-DD" value
 * from a date input already parses to midnight UTC, so this is a no-op for
 * the common case and truncates the day for full timestamps.
 */
export function normalizeSessionDate(date: Date | string): Date {
  const d = new Date(date)
  if (isNaN(d.getTime())) {
    throw new Error('Invalid session date')
  }
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * The most recent Sunday on or before the given date — the default date when
 * a servant opens the attendance page. Derived from the viewer's local
 * calendar day, but returned as midnight UTC like every stored session date.
 */
export function getMostRecentSunday(date: Date = new Date()): Date {
  const local = new Date(date)
  return new Date(
    Date.UTC(local.getFullYear(), local.getMonth(), local.getDate() - local.getDay())
  )
}

/** "YYYY-MM-DD" for a stored (midnight UTC) session date. */
export function toDateInputValue(date: Date): string {
  return date.toISOString().split('T')[0]
}

/** "YYYY-MM-DD" for the viewer's local today — used to cap the date picker. */
export function getTodayDateInputValue(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function getChildFullName(child: { firstName: string; lastName: string }): string {
  return `${child.firstName} ${child.lastName}`.trim()
}
