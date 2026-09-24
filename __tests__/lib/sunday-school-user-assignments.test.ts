import { describe, expect, it } from 'vitest'
import { SundaySchoolLevel } from '@prisma/client'
import { getSundaySchoolAssignmentLevels } from '@/lib/sunday-school-user-assignments'

describe('Sunday School user assignment levels', () => {
  it('combines direct class and age-group assignments in grade order', () => {
    expect(getSundaySchoolAssignmentLevels([
      {
        class: { level: SundaySchoolLevel.GRADE_10 },
        ageGroup: null,
      },
      {
        class: null,
        ageGroup: {
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
        class: { level: SundaySchoolLevel.SPECIAL_NEEDS },
        ageGroup: null,
      },
      {
        class: null,
        ageGroup: {
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
