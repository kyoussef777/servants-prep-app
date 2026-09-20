import { describe, expect, it } from 'vitest'
import { sortStudentTableRows } from '@/lib/student-table-sort'

const students = [
  {
    id: 'charlie',
    name: 'Charlie',
    enrollments: [{ yearLevel: 'YEAR_2' as const, status: 'ACTIVE' as const }],
  },
  {
    id: 'alice',
    name: 'Alice',
    enrollments: [{ yearLevel: 'YEAR_1' as const, status: 'ACTIVE' as const }],
  },
  {
    id: 'bob',
    name: 'Bob',
    enrollments: [{ yearLevel: 'YEAR_2' as const, status: 'GRADUATED' as const }],
  },
  { id: 'no-enrollment', name: 'No Enrollment' },
]

const analytics = [
  {
    studentId: 'charlie',
    year1AttendancePercentage: 82,
    year2AttendancePercentage: 74,
    avgExamScore: 88,
    graduationEligible: true,
  },
  {
    studentId: 'alice',
    year1AttendancePercentage: 91,
    year2AttendancePercentage: null,
    avgExamScore: 79,
    graduationEligible: false,
  },
  {
    studentId: 'bob',
    year1AttendancePercentage: 76,
    year2AttendancePercentage: 95,
    avgExamScore: null,
    graduationEligible: false,
  },
]

describe('sortStudentTableRows', () => {
  it('sorts names in either direction without mutating the input', () => {
    expect(sortStudentTableRows(students, analytics, 'name', 'asc').map((student) => student.name))
      .toEqual(['Alice', 'Bob', 'Charlie', 'No Enrollment'])
    expect(sortStudentTableRows(students, analytics, 'name', 'desc').map((student) => student.name))
      .toEqual(['No Enrollment', 'Charlie', 'Bob', 'Alice'])
    expect(students.map((student) => student.name)).toEqual(['Charlie', 'Alice', 'Bob', 'No Enrollment'])
  })

  it('sorts numeric analytics and keeps missing values last in both directions', () => {
    expect(sortStudentTableRows(students, analytics, 'year2Attendance', 'asc').map((student) => student.id))
      .toEqual(['charlie', 'bob', 'alice', 'no-enrollment'])
    expect(sortStudentTableRows(students, analytics, 'year2Attendance', 'desc').map((student) => student.id))
      .toEqual(['bob', 'charlie', 'alice', 'no-enrollment'])
  })

  it('sorts year, eligibility, and status from their displayed values', () => {
    expect(sortStudentTableRows(students, analytics, 'year', 'asc').map((student) => student.id))
      .toEqual(['alice', 'bob', 'charlie', 'no-enrollment'])
    expect(sortStudentTableRows(students, analytics, 'eligibility', 'asc').map((student) => student.id))
      .toEqual(['charlie', 'bob', 'alice', 'no-enrollment'])
    expect(sortStudentTableRows(students, analytics, 'status', 'desc').map((student) => student.id))
      .toEqual(['bob', 'alice', 'charlie', 'no-enrollment'])
  })
})
