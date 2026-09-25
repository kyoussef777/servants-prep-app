import type { SundaySchoolAuthority, SundaySchoolLevel } from '@prisma/client'
import { LEVEL_ORDER } from './sunday-school-class'

export interface SundaySchoolAssignmentSummary {
  id: string
  authority: SundaySchoolAuthority
  classId: string | null
  ageGroupId: string | null
  class: { id: string; name: string; level: SundaySchoolLevel } | null
  ageGroup: { id: string; name: string; levels: SundaySchoolLevel[] } | null
}

const LEVEL_INDEX = new Map(LEVEL_ORDER.map((level, index) => [level, index]))

/**
 * Flatten direct class assignments and age-group coordinator assignments into
 * the grade levels a person currently serves, without duplicate labels.
 */
export function getSundaySchoolAssignmentLevels(
  assignments: SundaySchoolAssignmentSummary[] | undefined
): SundaySchoolLevel[] {
  const levels = new Set<SundaySchoolLevel>()

  for (const assignment of assignments ?? []) {
    if (assignment.class) levels.add(assignment.class.level)
    for (const level of assignment.ageGroup?.levels ?? []) levels.add(level)
  }

  return Array.from(levels).sort(
    (left, right) =>
      (LEVEL_INDEX.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (LEVEL_INDEX.get(right) ?? Number.MAX_SAFE_INTEGER)
  )
}
