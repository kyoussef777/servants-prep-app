import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date string as UTC to avoid timezone shifts.
 * Use this for dates that represent a specific calendar day (not a moment in time).
 * This prevents dates stored as midnight UTC from appearing as the previous day
 * when displayed in timezones west of UTC (like EST/PST).
 */
export function formatDateUTC(dateStr: string | Date, options?: Intl.DateTimeFormatOptions) {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  const defaultOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }
  // Always force UTC timezone to prevent server/client hydration mismatches
  // and ensure consistent date display regardless of where the code runs
  return date.toLocaleDateString('en-US', { ...defaultOptions, ...options, timeZone: 'UTC' })
}

/**
 * Format a timestamp for toast notification descriptions.
 * Produces output like: "Jun 15, 2024, 2:30 PM"
 */
export function formatToastTimestamp(date: Date = new Date()): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Build a deduplicated student array from enrollment data.
 * Groups multiple enrollments under the same student.
 */
export interface EnrollmentForStudentMap {
  isActive: boolean
  student: { id: string; name: string; [key: string]: unknown }
  yearLevel: string
  mentor?: { id: string; [key: string]: unknown } | null
}

export interface StudentWithEnrollments {
  id: string
  name: string
  enrollments: Array<{ yearLevel: string; mentorId?: string }>
  [key: string]: unknown
}

export function buildStudentMapFromEnrollments(
  enrollmentsData: EnrollmentForStudentMap[]
): StudentWithEnrollments[] {
  const studentMap = new Map<string, StudentWithEnrollments>()
  if (Array.isArray(enrollmentsData)) {
    for (const enrollment of enrollmentsData) {
      if (enrollment.isActive) {
        const student = enrollment.student
        if (!studentMap.has(student.id)) {
          studentMap.set(student.id, {
            ...student,
            enrollments: []
          })
        }
        studentMap.get(student.id)!.enrollments.push({
          yearLevel: enrollment.yearLevel,
          mentorId: enrollment.mentor?.id
        })
      }
    }
  }
  return Array.from(studentMap.values())
}
