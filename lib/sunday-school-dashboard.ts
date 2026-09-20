import type { AttendanceStatus, SundaySchoolServantAttendanceStatus } from '@prisma/client'

const DAY_MS = 24 * 60 * 60 * 1000

export interface SundaySchoolAttendanceSessionInput {
  date: Date
  attendance: Array<{ status: AttendanceStatus | SundaySchoolServantAttendanceStatus }>
}

export interface SundaySchoolAttendanceTrendPoint {
  date: string
  attendedCount: number | null
  rosterCount: number | null
  attendanceRate: number | null
}

/** The first Sunday strictly after September 11 in the given Gregorian year. */
export function getFirstSundayAfterSeptember11(year: number): Date {
  const firstPossibleDay = new Date(Date.UTC(year, 8, 12))
  const daysUntilSunday = (7 - firstPossibleDay.getUTCDay()) % 7
  return new Date(firstPossibleDay.getTime() + daysUntilSunday * DAY_MS)
}

/** The most recent Sunday on or before a UTC calendar day. */
export function getMostRecentSundayUTC(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - date.getUTCDay()
    )
  )
}

/**
 * Sunday School reporting follows the class year: first Sunday after
 * September 11 through the last Sunday before the next rollover.
 */
export function getSundaySchoolReportingRange(
  academicYearStart: Date,
  isActive: boolean,
  today: Date = new Date()
): { start: Date; end: Date } {
  const startYear = academicYearStart.getUTCFullYear()
  const start = getFirstSundayAfterSeptember11(startYear)
  const nextStart = getFirstSundayAfterSeptember11(startYear + 1)
  const lastSundayInYear = new Date(nextStart.getTime() - 7 * DAY_MS)

  if (!isActive) return { start, end: lastSundayInYear }

  const mostRecentSunday = getMostRecentSundayUTC(today)
  return {
    start,
    end: mostRecentSunday < lastSundayInYear ? mostRecentSunday : lastSundayInYear,
  }
}

/**
 * Aggregate every visible class on each Sunday. No saved roster means unknown,
 * so that week is represented by nulls and Recharts renders a real gap.
 */
export function buildSundaySchoolAttendanceTrend(
  sessions: SundaySchoolAttendanceSessionInput[],
  start: Date,
  end: Date
): SundaySchoolAttendanceTrendPoint[] {
  if (end < start) return []

  const totalsByDate = new Map<string, { attended: number; roster: number }>()

  for (const session of sessions) {
    if (session.attendance.length === 0) continue

    const date = session.date.toISOString().slice(0, 10)
    const totals = totalsByDate.get(date) ?? { attended: 0, roster: 0 }
    totals.roster += session.attendance.length
    totals.attended += session.attendance.filter(
      record => record.status === 'PRESENT' || record.status === 'LATE'
    ).length
    totalsByDate.set(date, totals)
  }

  const points: SundaySchoolAttendanceTrendPoint[] = []
  for (let sunday = start; sunday <= end; sunday = new Date(sunday.getTime() + 7 * DAY_MS)) {
    const date = sunday.toISOString().slice(0, 10)
    const totals = totalsByDate.get(date)

    points.push({
      date,
      attendedCount: totals?.attended ?? null,
      rosterCount: totals?.roster ?? null,
      attendanceRate: totals
        ? Math.round((totals.attended / totals.roster) * 1000) / 10
        : null,
    })
  }

  return points
}
