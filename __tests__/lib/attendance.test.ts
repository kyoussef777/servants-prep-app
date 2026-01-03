import { describe, it, expect } from 'vitest'
import {
  calculateAttendanceStats,
  meetsAttendanceRequirement,
  calculateExamStats,
  checkGraduationEligibility,
  type AttendanceRecord,
  type ExamScore,
} from '@/lib/attendance'

describe('calculateAttendanceStats', () => {
  describe('basic counting', () => {
    it('should count all status types correctly', () => {
      const records: AttendanceRecord[] = [
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'LATE' },
        { status: 'ABSENT' },
        { status: 'EXCUSED' },
      ]

      const stats = calculateAttendanceStats(records, 5)

      expect(stats.presentCount).toBe(2)
      expect(stats.lateCount).toBe(1)
      expect(stats.absentCount).toBe(1)
      expect(stats.excusedCount).toBe(1)
    })

    it('should handle empty records', () => {
      const stats = calculateAttendanceStats([], 0)

      expect(stats.presentCount).toBe(0)
      expect(stats.lateCount).toBe(0)
      expect(stats.absentCount).toBe(0)
      expect(stats.excusedCount).toBe(0)
      expect(stats.percentage).toBe(0)
    })
  })

  describe('attendance formula', () => {
    it('should calculate effectivePresent as present + (lates / 2)', () => {
      const records: AttendanceRecord[] = [
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'LATE' },
        { status: 'LATE' },
      ]

      const stats = calculateAttendanceStats(records, 4)

      // effectivePresent = 2 present + (2 lates / 2) = 2 + 1 = 3
      expect(stats.effectivePresent).toBe(3)
    })

    it('should calculate effectiveTotalLessons as totalLessons - excused', () => {
      const records: AttendanceRecord[] = [
        { status: 'PRESENT' },
        { status: 'EXCUSED' },
        { status: 'EXCUSED' },
      ]

      const stats = calculateAttendanceStats(records, 10)

      // effectiveTotalLessons = 10 - 2 = 8
      expect(stats.effectiveTotalLessons).toBe(8)
    })

    it('should calculate percentage correctly', () => {
      const records: AttendanceRecord[] = [
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'ABSENT' },
      ]

      const stats = calculateAttendanceStats(records, 4)

      // percentage = (3 / 4) * 100 = 75%
      expect(stats.percentage).toBe(75)
    })

    it('should handle the 75% threshold correctly', () => {
      // Exactly 75% should pass
      const records75: AttendanceRecord[] = [
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'ABSENT' },
      ]
      expect(calculateAttendanceStats(records75, 4).met).toBe(true)

      // Below 75% should fail
      const records74: AttendanceRecord[] = [
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'ABSENT' },
        { status: 'ABSENT' },
      ]
      expect(calculateAttendanceStats(records74, 4).met).toBe(false)
    })

    it('should return 0% when no effective lessons (all excused)', () => {
      const records: AttendanceRecord[] = [
        { status: 'EXCUSED' },
        { status: 'EXCUSED' },
      ]

      const stats = calculateAttendanceStats(records, 2)

      expect(stats.effectiveTotalLessons).toBe(0)
      expect(stats.percentage).toBe(0)
    })
  })

  describe('excused absences', () => {
    it('should exclude excused from both numerator and denominator', () => {
      // 3 present out of 4, plus 1 excused
      // Effective: 3/4 = 75%
      const records: AttendanceRecord[] = [
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'ABSENT' },
        { status: 'EXCUSED' },
      ]

      const stats = calculateAttendanceStats(records, 5)

      expect(stats.effectiveTotalLessons).toBe(4) // 5 - 1 excused
      expect(stats.effectivePresent).toBe(3)
      expect(stats.percentage).toBe(75)
      expect(stats.met).toBe(true)
    })

    it('should handle multiple excused correctly', () => {
      // 2 present, 1 absent, 3 excused
      // Effective: 2/3 = 66.67%
      const records: AttendanceRecord[] = [
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'ABSENT' },
        { status: 'EXCUSED' },
        { status: 'EXCUSED' },
        { status: 'EXCUSED' },
      ]

      const stats = calculateAttendanceStats(records, 6)

      expect(stats.effectiveTotalLessons).toBe(3)
      expect(stats.effectivePresent).toBe(2)
      expect(stats.percentage).toBeCloseTo(66.67, 1)
      expect(stats.met).toBe(false)
    })
  })

  describe('late calculation (2 lates = 1 absence)', () => {
    it('should count 2 lates as equivalent to 1 present', () => {
      // 2 late = 1 present equivalent
      const records: AttendanceRecord[] = [
        { status: 'LATE' },
        { status: 'LATE' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
      ]

      const stats = calculateAttendanceStats(records, 4)

      // effectivePresent = 2 + (2/2) = 3
      expect(stats.effectivePresent).toBe(3)
      expect(stats.percentage).toBe(75)
    })

    it('should handle odd number of lates correctly', () => {
      // 3 lates = 1.5 present equivalent
      const records: AttendanceRecord[] = [
        { status: 'LATE' },
        { status: 'LATE' },
        { status: 'LATE' },
        { status: 'PRESENT' },
      ]

      const stats = calculateAttendanceStats(records, 4)

      // effectivePresent = 1 + (3/2) = 1 + 1.5 = 2.5
      expect(stats.effectivePresent).toBe(2.5)
      expect(stats.percentage).toBe(62.5)
    })
  })

  describe('custom required percentage', () => {
    it('should use custom required percentage', () => {
      const records: AttendanceRecord[] = [
        { status: 'PRESENT' },
        { status: 'ABSENT' },
      ]

      const stats50 = calculateAttendanceStats(records, 2, 50)
      expect(stats50.met).toBe(true)
      expect(stats50.required).toBe(50)

      const stats60 = calculateAttendanceStats(records, 2, 60)
      expect(stats60.met).toBe(false)
      expect(stats60.required).toBe(60)
    })
  })
})

describe('meetsAttendanceRequirement', () => {
  it('should return true when attendance requirement is met', () => {
    const records: AttendanceRecord[] = [
      { status: 'PRESENT' },
      { status: 'PRESENT' },
      { status: 'PRESENT' },
      { status: 'ABSENT' },
    ]

    expect(meetsAttendanceRequirement(records, 4)).toBe(true)
  })

  it('should return false when attendance requirement is not met', () => {
    const records: AttendanceRecord[] = [
      { status: 'PRESENT' },
      { status: 'ABSENT' },
      { status: 'ABSENT' },
      { status: 'ABSENT' },
    ]

    expect(meetsAttendanceRequirement(records, 4)).toBe(false)
  })
})

describe('calculateExamStats', () => {
  describe('section averages', () => {
    it('should calculate averages per section correctly', () => {
      const scores: ExamScore[] = [
        { percentage: 80, sectionName: 'Bible Studies' },
        { percentage: 90, sectionName: 'Bible Studies' },
        { percentage: 70, sectionName: 'Dogma' },
      ]

      const stats = calculateExamStats(scores)

      const bibleSection = stats.sectionAverages.find(s => s.section === 'Bible Studies')
      const dogmaSection = stats.sectionAverages.find(s => s.section === 'Dogma')

      expect(bibleSection?.average).toBe(85)
      expect(dogmaSection?.average).toBe(70)
    })

    it('should mark sections as passing or failing', () => {
      const scores: ExamScore[] = [
        { percentage: 70, sectionName: 'Bible Studies' }, // >= 60, passing
        { percentage: 50, sectionName: 'Dogma' }, // < 60, failing
      ]

      const stats = calculateExamStats(scores)

      const bibleSection = stats.sectionAverages.find(s => s.section === 'Bible Studies')
      const dogmaSection = stats.sectionAverages.find(s => s.section === 'Dogma')

      expect(bibleSection?.passingMet).toBe(true)
      expect(dogmaSection?.passingMet).toBe(false)
    })
  })

  describe('overall average', () => {
    it('should calculate overall average correctly', () => {
      const scores: ExamScore[] = [
        { percentage: 80, sectionName: 'Bible Studies' },
        { percentage: 70, sectionName: 'Dogma' },
        { percentage: 90, sectionName: 'Church History' },
      ]

      const stats = calculateExamStats(scores)

      // (80 + 70 + 90) / 3 = 80
      expect(stats.overallAverage).toBe(80)
    })

    it('should mark overall average as met when >= 75', () => {
      const scores: ExamScore[] = [
        { percentage: 75, sectionName: 'Bible Studies' },
        { percentage: 75, sectionName: 'Dogma' },
      ]

      const stats = calculateExamStats(scores)

      expect(stats.overallAverageMet).toBe(true)
    })

    it('should mark overall average as not met when < 75', () => {
      const scores: ExamScore[] = [
        { percentage: 70, sectionName: 'Bible Studies' },
        { percentage: 70, sectionName: 'Dogma' },
      ]

      const stats = calculateExamStats(scores)

      expect(stats.overallAverageMet).toBe(false)
    })

    it('should handle empty scores', () => {
      const stats = calculateExamStats([])

      expect(stats.overallAverage).toBe(0)
      expect(stats.overallAverageMet).toBe(false)
      expect(stats.allSectionsPassing).toBe(true) // vacuously true
    })
  })

  describe('all sections passing', () => {
    it('should return true when all sections have >= 60%', () => {
      const scores: ExamScore[] = [
        { percentage: 60, sectionName: 'Bible Studies' },
        { percentage: 70, sectionName: 'Dogma' },
        { percentage: 80, sectionName: 'Church History' },
      ]

      const stats = calculateExamStats(scores)

      expect(stats.allSectionsPassing).toBe(true)
    })

    it('should return false when any section has < 60%', () => {
      const scores: ExamScore[] = [
        { percentage: 90, sectionName: 'Bible Studies' },
        { percentage: 59, sectionName: 'Dogma' }, // Failing
        { percentage: 80, sectionName: 'Church History' },
      ]

      const stats = calculateExamStats(scores)

      expect(stats.allSectionsPassing).toBe(false)
    })
  })

  describe('custom thresholds', () => {
    it('should use custom required average and minimum', () => {
      const scores: ExamScore[] = [
        { percentage: 70, sectionName: 'Bible Studies' },
        { percentage: 70, sectionName: 'Dogma' },
      ]

      const stats = calculateExamStats(scores, 70, 70)

      expect(stats.requiredAverage).toBe(70)
      expect(stats.requiredMinimum).toBe(70)
      expect(stats.overallAverageMet).toBe(true)
      expect(stats.allSectionsPassing).toBe(true)
    })
  })
})

describe('checkGraduationEligibility', () => {
  const createAttendanceStats = (met: boolean) => ({
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    excusedCount: 0,
    totalLessons: 0,
    effectivePresent: 0,
    effectiveTotalLessons: 0,
    percentage: met ? 80 : 50,
    met,
    required: 75,
  })

  const createExamStats = (overallMet: boolean, allPassing: boolean) => ({
    sectionAverages: [],
    overallAverage: overallMet ? 80 : 50,
    overallAverageMet: overallMet,
    allSectionsPassing: allPassing,
    requiredAverage: 75,
    requiredMinimum: 60,
  })

  it('should be eligible when all requirements are met', () => {
    const attendance = createAttendanceStats(true)
    const exams = createExamStats(true, true)

    const result = checkGraduationEligibility(attendance, exams)

    expect(result.eligible).toBe(true)
    expect(result.attendanceMet).toBe(true)
    expect(result.overallAverageMet).toBe(true)
    expect(result.allSectionsPassing).toBe(true)
  })

  it('should not be eligible when attendance is not met', () => {
    const attendance = createAttendanceStats(false)
    const exams = createExamStats(true, true)

    const result = checkGraduationEligibility(attendance, exams)

    expect(result.eligible).toBe(false)
    expect(result.attendanceMet).toBe(false)
  })

  it('should not be eligible when overall exam average is not met', () => {
    const attendance = createAttendanceStats(true)
    const exams = createExamStats(false, true)

    const result = checkGraduationEligibility(attendance, exams)

    expect(result.eligible).toBe(false)
    expect(result.overallAverageMet).toBe(false)
  })

  it('should not be eligible when any section is failing', () => {
    const attendance = createAttendanceStats(true)
    const exams = createExamStats(true, false)

    const result = checkGraduationEligibility(attendance, exams)

    expect(result.eligible).toBe(false)
    expect(result.allSectionsPassing).toBe(false)
  })

  it('should not be eligible when multiple requirements are not met', () => {
    const attendance = createAttendanceStats(false)
    const exams = createExamStats(false, false)

    const result = checkGraduationEligibility(attendance, exams)

    expect(result.eligible).toBe(false)
    expect(result.attendanceMet).toBe(false)
    expect(result.overallAverageMet).toBe(false)
    expect(result.allSectionsPassing).toBe(false)
  })
})

describe('Real-world scenarios', () => {
  it('should handle a typical student with mixed attendance', () => {
    // 10 lessons: 6 present, 2 late, 1 absent, 1 excused
    const records: AttendanceRecord[] = [
      { status: 'PRESENT' },
      { status: 'PRESENT' },
      { status: 'PRESENT' },
      { status: 'PRESENT' },
      { status: 'PRESENT' },
      { status: 'PRESENT' },
      { status: 'LATE' },
      { status: 'LATE' },
      { status: 'ABSENT' },
      { status: 'EXCUSED' },
    ]

    const stats = calculateAttendanceStats(records, 10)

    // effectivePresent = 6 + (2/2) = 7
    // effectiveTotalLessons = 10 - 1 = 9
    // percentage = 7/9 * 100 = 77.78%
    expect(stats.effectivePresent).toBe(7)
    expect(stats.effectiveTotalLessons).toBe(9)
    expect(stats.percentage).toBeCloseTo(77.78, 1)
    expect(stats.met).toBe(true)
  })

  it('should handle a student barely meeting requirements', () => {
    // Exactly 75% attendance, exactly 75% exam average, all sections >= 60%
    const attendanceRecords: AttendanceRecord[] = [
      { status: 'PRESENT' },
      { status: 'PRESENT' },
      { status: 'PRESENT' },
      { status: 'ABSENT' },
    ]

    const examScores: ExamScore[] = [
      { percentage: 75, sectionName: 'Bible Studies' },
      { percentage: 75, sectionName: 'Dogma' },
      { percentage: 75, sectionName: 'Church History' },
    ]

    const attendanceStats = calculateAttendanceStats(attendanceRecords, 4)
    const examStats = calculateExamStats(examScores)
    const graduation = checkGraduationEligibility(attendanceStats, examStats)

    expect(graduation.eligible).toBe(true)
  })

  it('should handle a student who failed due to one low section', () => {
    const attendanceRecords: AttendanceRecord[] = [
      { status: 'PRESENT' },
      { status: 'PRESENT' },
      { status: 'PRESENT' },
      { status: 'PRESENT' },
    ]

    const examScores: ExamScore[] = [
      { percentage: 90, sectionName: 'Bible Studies' },
      { percentage: 85, sectionName: 'Dogma' },
      { percentage: 55, sectionName: 'Church History' }, // Below 60%
    ]

    const attendanceStats = calculateAttendanceStats(attendanceRecords, 4)
    const examStats = calculateExamStats(examScores)
    const graduation = checkGraduationEligibility(attendanceStats, examStats)

    // Overall average is 76.67%, but one section is below 60%
    expect(graduation.eligible).toBe(false)
    expect(graduation.attendanceMet).toBe(true)
    expect(graduation.overallAverageMet).toBe(true)
    expect(graduation.allSectionsPassing).toBe(false)
  })
})
