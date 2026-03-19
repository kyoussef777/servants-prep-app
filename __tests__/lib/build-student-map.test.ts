import { describe, it, expect } from 'vitest'
import { buildStudentMapFromEnrollments } from '@/lib/utils'
import type { EnrollmentForStudentMap } from '@/lib/utils'

type EnrollmentData = EnrollmentForStudentMap

describe('buildStudentMapFromEnrollments', () => {
  it('should return empty array for empty input', () => {
    expect(buildStudentMapFromEnrollments([])).toEqual([])
  })

  it('should filter out inactive enrollments', () => {
    const enrollments: EnrollmentData[] = [
      {
        isActive: false,
        student: { id: 's1', name: 'Inactive Student' },
        yearLevel: 'YEAR_1',
      },
      {
        isActive: true,
        student: { id: 's2', name: 'Active Student' },
        yearLevel: 'YEAR_1',
      },
    ]

    const result = buildStudentMapFromEnrollments(enrollments)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s2')
    expect(result[0].name).toBe('Active Student')
  })

  it('should merge multiple enrollments for the same student', () => {
    const enrollments: EnrollmentData[] = [
      {
        isActive: true,
        student: { id: 's1', name: 'John Doe' },
        yearLevel: 'YEAR_1',
        mentor: { id: 'm1' },
      },
      {
        isActive: true,
        student: { id: 's1', name: 'John Doe' },
        yearLevel: 'YEAR_2',
        mentor: { id: 'm2' },
      },
    ]

    const result = buildStudentMapFromEnrollments(enrollments)
    expect(result).toHaveLength(1)
    expect(result[0].enrollments).toHaveLength(2)
    expect(result[0].enrollments[0]).toEqual({ yearLevel: 'YEAR_1', mentorId: 'm1' })
    expect(result[0].enrollments[1]).toEqual({ yearLevel: 'YEAR_2', mentorId: 'm2' })
  })

  it('should handle enrollments without mentors', () => {
    const enrollments: EnrollmentData[] = [
      {
        isActive: true,
        student: { id: 's1', name: 'No Mentor Student' },
        yearLevel: 'YEAR_1',
      },
    ]

    const result = buildStudentMapFromEnrollments(enrollments)
    expect(result).toHaveLength(1)
    expect(result[0].enrollments[0].mentorId).toBeUndefined()
  })

  it('should keep different students separate', () => {
    const enrollments: EnrollmentData[] = [
      {
        isActive: true,
        student: { id: 's1', name: 'Alice' },
        yearLevel: 'YEAR_1',
        mentor: { id: 'm1' },
      },
      {
        isActive: true,
        student: { id: 's2', name: 'Bob' },
        yearLevel: 'YEAR_1',
        mentor: { id: 'm1' },
      },
    ]

    const result = buildStudentMapFromEnrollments(enrollments)
    expect(result).toHaveLength(2)
    expect(result.find(s => s.id === 's1')?.name).toBe('Alice')
    expect(result.find(s => s.id === 's2')?.name).toBe('Bob')
  })

  it('should preserve all student properties', () => {
    const enrollments: EnrollmentData[] = [
      {
        isActive: true,
        student: { id: 's1', name: 'Test Student', email: 'test@example.com' },
        yearLevel: 'YEAR_1',
      },
    ]

    const result = buildStudentMapFromEnrollments(enrollments)
    expect(result[0]).toMatchObject({
      id: 's1',
      name: 'Test Student',
      email: 'test@example.com',
    })
  })

  it('should handle mix of active and inactive enrollments for same student', () => {
    const enrollments: EnrollmentData[] = [
      {
        isActive: true,
        student: { id: 's1', name: 'Student' },
        yearLevel: 'YEAR_1',
      },
      {
        isActive: false,
        student: { id: 's1', name: 'Student' },
        yearLevel: 'YEAR_2',
      },
    ]

    const result = buildStudentMapFromEnrollments(enrollments)
    expect(result).toHaveLength(1)
    expect(result[0].enrollments).toHaveLength(1)
    expect(result[0].enrollments[0].yearLevel).toBe('YEAR_1')
  })
})
