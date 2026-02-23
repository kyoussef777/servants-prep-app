/**
 * Shared TypeScript types used across multiple pages and components.
 * Centralizes interfaces that were previously duplicated in individual page files.
 */

export interface AcademicYear {
  id: string
  name: string
  startDate?: string
  endDate?: string
  isActive: boolean
}

export interface ExamSection {
  id: string
  name: string
  displayName: string
  passingScore?: number
  averageRequirement?: number
}

export interface StudentEnrollment {
  id: string
  yearLevel: 'YEAR_1' | 'YEAR_2'
  isActive: boolean
  isAsyncStudent?: boolean
  status: 'ACTIVE' | 'GRADUATED' | 'WITHDRAWN'
  notes?: string
  mentor?: {
    id: string
    name: string
  }
  fatherOfConfession?: {
    id: string
    name: string
    phone?: string
    church?: string
  }
  academicYear?: AcademicYear | null
  graduatedAcademicYear?: AcademicYear | null
}

export interface StudentAnalytics {
  studentId: string
  studentName: string
  yearLevel: 'YEAR_1' | 'YEAR_2'
  attendancePercentage: number | null
  year1AttendancePercentage: number | null
  year2AttendancePercentage: number | null
  avgExamScore: number | null
  examAverage: number | null
  totalLessons: number
  year1TotalLessons: number
  year2TotalLessons: number | null
  attendedLessons: number
  year1AttendedLessons: number
  year2AttendedLessons: number | null
  examCount: number
  graduationEligible: boolean
  attendanceMet: boolean
  examAverageMet: boolean
  allSectionsMet: boolean
}
