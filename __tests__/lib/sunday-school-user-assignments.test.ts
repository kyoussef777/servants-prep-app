import { describe, expect, it } from 'vitest'
import { SundaySchoolAuthority, SundaySchoolLevel } from '@prisma/client'
import { getSundaySchoolAssignmentLevels } from '@/lib/sunday-school-user-assignments'

describe('Sunday School user assignment levels', () => {
  it('combines direct class and age-group assignments in grade order', () => {
    expect(getSundaySchoolAssignmentLevels([
      {
        id: 'class-assignment',
        authority: SundaySchoolAuthority.SERVANT,
        classId: 'grade-10',
        ageGroupId: null,
        class: { id: 'grade-10', name: '10th Grade', level: SundaySchoolLevel.GRADE_10 },
        ageGroup: null,
      },
      {
        id: 'age-group-assignment',
        authority: SundaySchoolAuthority.COORDINATOR,
        classId: null,
        ageGroupId: 'middle-school',
        class: null,
        ageGroup: {
          id: 'middle-school',
          name: 'Middle School',
          levels: [
            SundaySchoolLevel.GRADE_7,
            SundaySchoolLevel.GRADE_6,
            SundaySchoolLevel.GRADE_8,
          ],
        },
      },
    ])).toEqual([
      SundaySchoolLevel.GRADE_6,
      SundaySchoolLevel.GRADE_7,
      SundaySchoolLevel.GRADE_8,
      SundaySchoolLevel.GRADE_10,
    ])
  })

  it('deduplicates a grade served through more than one assignment', () => {
    expect(getSundaySchoolAssignmentLevels([
      {
        id: 'special-needs-assignment',
        authority: SundaySchoolAuthority.SERVANT,
        classId: 'special-needs',
        ageGroupId: null,
        class: {
          id: 'special-needs',
          name: 'Special Needs',
          level: SundaySchoolLevel.SPECIAL_NEEDS,
        },
        ageGroup: null,
      },
      {
        id: 'elementary-assignment',
        authority: SundaySchoolAuthority.COORDINATOR,
        classId: null,
        ageGroupId: 'elementary',
        class: null,
        ageGroup: {
          id: 'elementary',
          name: 'Elementary School',
          levels: [SundaySchoolLevel.GRADE_5, SundaySchoolLevel.SPECIAL_NEEDS],
        },
      },
    ])).toEqual([
      SundaySchoolLevel.GRADE_5,
      SundaySchoolLevel.SPECIAL_NEEDS,
    ])
  })

  it('returns no grades for a user with only an access tag', () => {
    expect(getSundaySchoolAssignmentLevels(undefined)).toEqual([])
  })
})
