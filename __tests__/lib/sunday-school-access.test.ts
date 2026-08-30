import { describe, it, expect } from 'vitest'
import {
  canCoordinateAgeGroup,
  canCoordinateClass,
  canCreateClassAtLevel,
  canDeleteClass,
  canServeClass,
  canViewClass,
  visibleClassFilter,
  type SundaySchoolAccess,
} from '@/lib/sunday-school-access'
import { assertLevelsUnclaimed, findAgeGroupForLevel } from '@/lib/sunday-school-class'
import type { SundaySchoolLevel } from '@prisma/client'

/**
 * These cover the predicates over a resolved SundaySchoolAccess — the part of
 * the authority model that is pure. Resolution itself (reading assignments and
 * expanding an age group into its classes) needs a database.
 */

const CLASS_A = 'class-grade-2'
const CLASS_B = 'class-grade-9'
const CLASS_C = 'class-grade-11'
const HIGH_SCHOOL = 'band-high'

function makeAccess(overrides: Partial<SundaySchoolAccess> = {}): SundaySchoolAccess {
  const base: SundaySchoolAccess = {
    isAdmin: false,
    readOnly: false,
    canRead: true,
    servantClassIds: new Set<string>(),
    coordinatorClassIds: new Set<string>(),
    coordinatorAgeGroupIds: new Set<string>(),
    coordinatorLevels: new Set<SundaySchoolLevel>(),
    visibleClassIds: new Set<string>(),
    ...overrides,
  }
  // Keep visibility consistent with the assignments unless a test sets it
  if (!overrides.visibleClassIds && base.visibleClassIds !== 'all') {
    base.visibleClassIds = new Set<string>([
      ...base.servantClassIds,
      ...base.coordinatorClassIds,
    ])
  }
  return base
}

// A servant on one class, nothing else
const servantOfA = makeAccess({ servantClassIds: new Set([CLASS_A]) })

// Coordinator of a single class
const classCoordinator = makeAccess({ coordinatorClassIds: new Set([CLASS_A]) })

// High School coordinator: the band expands to its classes at resolve time
const highSchoolCoordinator = makeAccess({
  coordinatorClassIds: new Set([CLASS_B, CLASS_C]),
  coordinatorAgeGroupIds: new Set([HIGH_SCHOOL]),
  coordinatorLevels: new Set<SundaySchoolLevel>(['GRADE_9', 'GRADE_10', 'GRADE_11', 'GRADE_12']),
})

const superAdmin = makeAccess({ isAdmin: true, visibleClassIds: 'all' })
const priest = makeAccess({ readOnly: true, visibleClassIds: 'all' })

// A SERVANT_PREP who has not been assigned anything: the bug this model fixes
const unassignedPrepLeader = makeAccess({ canRead: false })

describe('Sunday School access predicates', () => {
  describe('an unassigned prep leader', () => {
    it('has no Sunday School access at all', () => {
      expect(unassignedPrepLeader.canRead).toBe(false)
      expect(canViewClass(unassignedPrepLeader, CLASS_A)).toBe(false)
      expect(canServeClass(unassignedPrepLeader, CLASS_A)).toBe(false)
      expect(canCoordinateClass(unassignedPrepLeader, CLASS_A)).toBe(false)
      expect(canCreateClassAtLevel(unassignedPrepLeader, 'GRADE_2')).toBe(false)
    })
  })

  describe('a servant of one class', () => {
    it('serves that class', () => {
      expect(canViewClass(servantOfA, CLASS_A)).toBe(true)
      expect(canServeClass(servantOfA, CLASS_A)).toBe(true)
    })

    it('cannot coordinate it', () => {
      expect(canCoordinateClass(servantOfA, CLASS_A)).toBe(false)
    })

    it('cannot touch another class', () => {
      expect(canViewClass(servantOfA, CLASS_B)).toBe(false)
      expect(canServeClass(servantOfA, CLASS_B)).toBe(false)
    })

    it('cannot create or delete classes', () => {
      expect(canCreateClassAtLevel(servantOfA, 'GRADE_2')).toBe(false)
      expect(canDeleteClass(servantOfA, 'GRADE_2')).toBe(false)
    })
  })

  describe('a class coordinator', () => {
    it('serves and coordinates their class', () => {
      expect(canServeClass(classCoordinator, CLASS_A)).toBe(true)
      expect(canCoordinateClass(classCoordinator, CLASS_A)).toBe(true)
    })

    it('cannot create or delete classes — that is the band coordinator', () => {
      expect(canCreateClassAtLevel(classCoordinator, 'GRADE_2')).toBe(false)
      expect(canDeleteClass(classCoordinator, 'GRADE_2')).toBe(false)
    })

    it('cannot reach a class they do not coordinate', () => {
      expect(canCoordinateClass(classCoordinator, CLASS_B)).toBe(false)
      expect(canServeClass(classCoordinator, CLASS_B)).toBe(false)
    })
  })

  describe('an age-group coordinator', () => {
    it('coordinates every class in their band', () => {
      expect(canCoordinateClass(highSchoolCoordinator, CLASS_B)).toBe(true)
      expect(canCoordinateClass(highSchoolCoordinator, CLASS_C)).toBe(true)
      expect(canServeClass(highSchoolCoordinator, CLASS_B)).toBe(true)
    })

    it('reaches nothing outside their band', () => {
      expect(canCoordinateClass(highSchoolCoordinator, CLASS_A)).toBe(false)
      expect(canServeClass(highSchoolCoordinator, CLASS_A)).toBe(false)
      expect(canViewClass(highSchoolCoordinator, CLASS_A)).toBe(false)
    })

    it('creates and deletes classes at their own levels only', () => {
      expect(canCreateClassAtLevel(highSchoolCoordinator, 'GRADE_11')).toBe(true)
      expect(canDeleteClass(highSchoolCoordinator, 'GRADE_11')).toBe(true)
      expect(canCreateClassAtLevel(highSchoolCoordinator, 'GRADE_2')).toBe(false)
      expect(canDeleteClass(highSchoolCoordinator, 'GRADE_2')).toBe(false)
    })

    it('coordinates their own band and no other', () => {
      expect(canCoordinateAgeGroup(highSchoolCoordinator, HIGH_SCHOOL)).toBe(true)
      expect(canCoordinateAgeGroup(highSchoolCoordinator, 'band-elementary')).toBe(false)
    })
  })

  describe('SUPER_ADMIN', () => {
    it('passes every check for any class', () => {
      expect(canViewClass(superAdmin, 'any-class')).toBe(true)
      expect(canServeClass(superAdmin, 'any-class')).toBe(true)
      expect(canCoordinateClass(superAdmin, 'any-class')).toBe(true)
      expect(canCreateClassAtLevel(superAdmin, 'PRE_K')).toBe(true)
      expect(canDeleteClass(superAdmin, 'GRADE_12')).toBe(true)
      expect(canCoordinateAgeGroup(superAdmin, 'any-band')).toBe(true)
    })
  })

  describe('PRIEST', () => {
    it('sees everything', () => {
      expect(canViewClass(priest, 'any-class')).toBe(true)
    })

    it('writes nothing', () => {
      expect(canServeClass(priest, 'any-class')).toBe(false)
      expect(canCoordinateClass(priest, 'any-class')).toBe(false)
      expect(canCreateClassAtLevel(priest, 'GRADE_3')).toBe(false)
      expect(canDeleteClass(priest, 'GRADE_3')).toBe(false)
      expect(canCoordinateAgeGroup(priest, HIGH_SCHOOL)).toBe(false)
    })
  })

  describe('visibleClassFilter', () => {
    it('returns undefined when no filter is needed', () => {
      expect(visibleClassFilter(superAdmin)).toBeUndefined()
      expect(visibleClassFilter(priest)).toBeUndefined()
    })

    it('lists the classes an assigned user may see', () => {
      expect(visibleClassFilter(servantOfA)).toEqual([CLASS_A])
      expect(visibleClassFilter(highSchoolCoordinator)?.sort()).toEqual([CLASS_B, CLASS_C].sort())
    })

    it('is empty for someone with no assignments', () => {
      expect(visibleClassFilter(unassignedPrepLeader)).toEqual([])
    })
  })
})

describe('age group level ownership', () => {
  const elementary = {
    name: 'Elementary',
    levels: ['PRE_K', 'KINDERGARTEN', 'GRADE_1', 'GRADE_2'] as SundaySchoolLevel[],
  }
  const middle = { name: 'Middle School', levels: ['GRADE_6', 'GRADE_7'] as SundaySchoolLevel[] }

  describe('assertLevelsUnclaimed', () => {
    it('accepts levels no other band owns', () => {
      expect(assertLevelsUnclaimed(['GRADE_9', 'GRADE_10'], [elementary, middle])).toBeNull()
    })

    it('rejects a level another band already owns, and names it', () => {
      const error = assertLevelsUnclaimed(['GRADE_2'], [elementary, middle])
      expect(error).toContain('Elementary')
      expect(error).toContain('2nd Grade')
    })

    it('reports every clashing level', () => {
      const error = assertLevelsUnclaimed(['GRADE_6', 'GRADE_7'], [middle])
      expect(error).toContain('6th Grade')
      expect(error).toContain('7th Grade')
    })

    it('allows a band to keep its own levels when it is excluded from the list', () => {
      expect(assertLevelsUnclaimed(elementary.levels, [middle])).toBeNull()
    })
  })

  describe('findAgeGroupForLevel', () => {
    it('finds the band owning a level', () => {
      expect(findAgeGroupForLevel('GRADE_7', [elementary, middle])?.name).toBe('Middle School')
    })

    it('returns undefined for an unbanded level', () => {
      expect(findAgeGroupForLevel('GRADE_12', [elementary, middle])).toBeUndefined()
    })
  })
})
