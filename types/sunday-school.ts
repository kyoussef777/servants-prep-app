import {
  AttendanceStatus,
  SundaySchoolAuthority,
  SundaySchoolFeedbackStatus,
  SundaySchoolFeedbackVoteType,
  SundaySchoolLevel,
  SundaySchoolVisitationStatus,
} from '@prisma/client'

// Shapes returned by the /api/sunday-school/* routes (Sunday School mode).

export interface SundaySchoolServantRef {
  id: string
  name: string
  email?: string
  phone?: string | null
  profileImageUrl?: string | null
}

export interface SundaySchoolAssignmentRow {
  id: string
  userId: string
  academicYearId: string
  authority: SundaySchoolAuthority
  classId: string | null
  ageGroupId: string | null
  user: SundaySchoolServantRef
  class?: SundaySchoolClassRef | null
  ageGroup?: { id: string; name: string } | null
}

export interface SundaySchoolAgeGroup {
  id: string
  name: string
  levels: SundaySchoolLevel[]
  sortOrder: number
  isActive: boolean
  canCoordinate?: boolean
  assignments?: SundaySchoolAssignmentRow[]
}

export interface SundaySchoolClassRef {
  id: string
  name: string
  level: SundaySchoolLevel
}

export interface SundaySchoolClass extends SundaySchoolClassRef {
  academicYearId: string
  academicYear?: { id: string; name: string } | null
  isActive: boolean
  assignments: SundaySchoolAssignmentRow[]
  _count?: { children: number; sessions: number }
  // What this viewer may do with this class, decided by the server
  canServe?: boolean
  canCoordinate?: boolean
  canDelete?: boolean
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

export interface SundaySchoolVisitationRecord {
  id: string
  status: SundaySchoolVisitationStatus
  visitedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  recorder: { id: string; name: string } | null
}

export interface SundaySchoolVisitationChild {
  id: string
  firstName: string
  lastName: string
  visitations: SundaySchoolVisitationRecord[]
}

export interface SundaySchoolVisitationClass extends SundaySchoolClassRef {
  canEdit: boolean
  children: SundaySchoolVisitationChild[]
}

export interface SundaySchoolVisitationsResponse {
  classes: SundaySchoolVisitationClass[]
  standing: {
    readOnly: boolean
    isAdmin: boolean
  }
}

export interface SundaySchoolFeedbackIdea {
  id: string
  title: string
  description: string | null
  status: SundaySchoolFeedbackStatus
  createdAt: string
  updatedAt: string
  submitter: {
    id: string
    name: string
    profileImageUrl: string | null
  } | null
  upvotes: number
  downvotes: number
  score: number
  viewerVote: SundaySchoolFeedbackVoteType | null
  canEdit: boolean
  canDelete: boolean
  canVote: boolean
}

export interface SundaySchoolFeedbackResponse {
  ideas: SundaySchoolFeedbackIdea[]
  statusCounts: Record<SundaySchoolFeedbackStatus, number>
  viewer: {
    canSubmit: boolean
    canModerate: boolean
  }
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
  ageGroup: { id: string; name: string } | null
  childCount: number
  sessionCount: number
  attendancePercentage: number
  latestSession: { id: string; date: string; topic: string | null } | null
  attendanceTakenThisWeek: boolean
  canServe: boolean
  canCoordinate: boolean
  servants: Array<{
    id: string
    name: string
    profileImageUrl: string | null
    isCoordinator: boolean
  }>
}

export interface SundaySchoolAttendanceTrendPoint {
  date: string
  attendedCount: number | null
  rosterCount: number | null
  attendanceRate: number | null
}

export interface SundaySchoolAcademicYearOption {
  id: string
  name: string
}

export interface SundaySchoolClassOption {
  id: string
  name: string
}

export interface SundaySchoolDashboard {
  classes: SundaySchoolClassSummary[]
  ageGroups: Array<{
    id: string
    name: string
    levels: SundaySchoolLevel[]
    canCoordinate: boolean
  }>
  totals: {
    classes: number
    children: number
    classesNeedingAttendance: number
  }
  standing: {
    isAdmin: boolean
    readOnly: boolean
    coordinatesAnyAgeGroup: boolean
  }
  attendanceTrend: {
    points: SundaySchoolAttendanceTrendPoint[]
    academicYears: SundaySchoolAcademicYearOption[]
    classes: SundaySchoolClassOption[]
    selectedAcademicYearId: string | null
    selectedClassId: string | null
    canSelectClass: boolean
    startDate: string | null
    endDate: string | null
  }
  weekOf: string
}
