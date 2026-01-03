/**
 * Attendance calculation utilities
 *
 * Formula: (Present + (Lates / 2)) / (TotalLessons - Excused)
 *
 * - PRESENT counts as 1
 * - LATE counts as 0.5 (2 lates = 1 absence)
 * - ABSENT counts as 0
 * - EXCUSED is excluded from both numerator and denominator
 * - Lessons marked as isExamDay are excluded from calculations
 */

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'

export interface AttendanceRecord {
  status: AttendanceStatus
}

export interface AttendanceStats {
  presentCount: number
  lateCount: number
  absentCount: number
  excusedCount: number
  totalLessons: number
  effectivePresent: number
  effectiveTotalLessons: number
  percentage: number
  met: boolean
  required: number
}

/**
 * Calculate attendance statistics from a list of attendance records
 *
 * @param records - Array of attendance records with status
 * @param totalLessonsWithAttendance - Total number of lessons where attendance was taken (excludes exam days)
 * @param requiredPercentage - Minimum percentage required (default: 75)
 * @returns AttendanceStats object with all calculated values
 */
export function calculateAttendanceStats(
  records: AttendanceRecord[],
  totalLessonsWithAttendance: number,
  requiredPercentage: number = 75
): AttendanceStats {
  const presentCount = records.filter(r => r.status === 'PRESENT').length
  const lateCount = records.filter(r => r.status === 'LATE').length
  const absentCount = records.filter(r => r.status === 'ABSENT').length
  const excusedCount = records.filter(r => r.status === 'EXCUSED').length

  // Formula: (Present + (Lates / 2)) / (TotalLessons - Excused)
  const effectivePresent = presentCount + (lateCount / 2)
  const effectiveTotalLessons = totalLessonsWithAttendance - excusedCount
  const percentage = effectiveTotalLessons > 0
    ? (effectivePresent / effectiveTotalLessons) * 100
    : 0
  const met = percentage >= requiredPercentage

  return {
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    totalLessons: totalLessonsWithAttendance,
    effectivePresent,
    effectiveTotalLessons,
    percentage,
    met,
    required: requiredPercentage,
  }
}

/**
 * Check if a student meets the attendance requirement
 *
 * @param records - Array of attendance records
 * @param totalLessons - Total lessons with attendance taken
 * @param requiredPercentage - Minimum required percentage (default: 75)
 * @returns boolean indicating if requirement is met
 */
export function meetsAttendanceRequirement(
  records: AttendanceRecord[],
  totalLessons: number,
  requiredPercentage: number = 75
): boolean {
  return calculateAttendanceStats(records, totalLessons, requiredPercentage).met
}

/**
 * Calculate exam section averages and overall average
 */
export interface ExamScore {
  percentage: number
  sectionName: string
}

export interface ExamStats {
  sectionAverages: { section: string; average: number; passingMet: boolean }[]
  overallAverage: number
  overallAverageMet: boolean
  allSectionsPassing: boolean
  requiredAverage: number
  requiredMinimum: number
}

/**
 * Calculate exam statistics from exam scores
 *
 * @param scores - Array of exam scores with percentage and section
 * @param requiredAverage - Minimum overall average required (default: 75)
 * @param requiredMinimum - Minimum per-section average required (default: 60)
 */
export function calculateExamStats(
  scores: ExamScore[],
  requiredAverage: number = 75,
  requiredMinimum: number = 60
): ExamStats {
  // Group scores by section
  const scoresBySection: { [key: string]: number[] } = {}
  scores.forEach(score => {
    if (!scoresBySection[score.sectionName]) {
      scoresBySection[score.sectionName] = []
    }
    scoresBySection[score.sectionName].push(score.percentage)
  })

  // Calculate averages per section
  const sectionAverages = Object.entries(scoresBySection).map(([section, sectionScores]) => {
    const average = sectionScores.reduce((a, b) => a + b, 0) / sectionScores.length
    return {
      section,
      average,
      passingMet: average >= requiredMinimum,
    }
  })

  // Calculate overall average
  const allScores = Object.values(scoresBySection).flat()
  const overallAverage = allScores.length > 0
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0
  const overallAverageMet = overallAverage >= requiredAverage

  // Check if all sections have at least minimum
  const allSectionsPassing = sectionAverages.every(s => s.passingMet)

  return {
    sectionAverages,
    overallAverage,
    overallAverageMet,
    allSectionsPassing,
    requiredAverage,
    requiredMinimum,
  }
}

/**
 * Check if a student meets all graduation requirements
 */
export interface GraduationStatus {
  eligible: boolean
  attendanceMet: boolean
  overallAverageMet: boolean
  allSectionsPassing: boolean
}

export function checkGraduationEligibility(
  attendanceStats: AttendanceStats,
  examStats: ExamStats
): GraduationStatus {
  const attendanceMet = attendanceStats.met
  const overallAverageMet = examStats.overallAverageMet
  const allSectionsPassing = examStats.allSectionsPassing

  return {
    eligible: attendanceMet && overallAverageMet && allSectionsPassing,
    attendanceMet,
    overallAverageMet,
    allSectionsPassing,
  }
}
