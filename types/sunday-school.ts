import { AttendanceStatus, SundaySchoolLevel } from '@prisma/client'

// Shapes returned by the /api/sunday-school/* routes (Sunday School mode).

export interface SundaySchoolServantRef {
  id: string
  name: string
  email?: string
  phone?: string | null
  profileImageUrl?: string | null
}

export interface SundaySchoolClassServant {
  id: string
  classId: string
  servantId: string
  isLead: boolean
  servant: SundaySchoolServantRef
}

export interface SundaySchoolClassRef {
  id: string
  name: string
  level: SundaySchoolLevel
}

export interface SundaySchoolClass extends SundaySchoolClassRef {
  academicYearId: string | null
  academicYear?: { id: string; name: string } | null
  isActive: boolean
  servants: SundaySchoolClassServant[]
  _count?: { children: number; sessions: number }
}

export interface SundaySchoolChild {
  id: string
  firstName: string
  lastName: string
  level: SundaySchoolLevel
  classId: string | null
  birthDate: string | null
  guardianName: string | null
  guardianPhone: string | null
  guardianEmail: string | null
  notes: string | null
  isActive: boolean
  class?: SundaySchoolClassRef | null
}

export interface SundaySchoolSession {
  id: string
  classId: string
  date: string
  topic: string | null
  notes: string | null
  takenBy: string | null
  class?: SundaySchoolClassRef
  taker?: { id: string; name: string } | null
  _count?: { attendance: number }
}

export interface SundaySchoolRosterEntry {
  id: string
  firstName: string
  lastName: string
  level: SundaySchoolLevel
  attendance: {
    id: string
    childId: string
    status: AttendanceStatus
    notes: string | null
  } | null
}

export interface SundaySchoolSessionAttendance {
  // null while a date has no recorded session yet — the roster is shown
  // unmarked and the session row is created on the first save
  session: SundaySchoolSession | null
  roster: SundaySchoolRosterEntry[]
}

export interface SundaySchoolClassSummary {
  id: string
  name: string
  level: SundaySchoolLevel
  childCount: number
  sessionCount: number
  attendancePercentage: number
  latestSession: { id: string; date: string; topic: string | null } | null
  attendanceTakenThisWeek: boolean
  servants: Array<{
    id: string
    name: string
    profileImageUrl: string | null
    isLead: boolean
  }>
}

export interface SundaySchoolDashboard {
  classes: SundaySchoolClassSummary[]
  totals: {
    classes: number
    children: number
    classesNeedingAttendance: number
  }
  weekOf: string
}
