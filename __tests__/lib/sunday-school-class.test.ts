import { describe, it, expect } from 'vitest'
import {
  LEVEL_ORDER,
  getChildFullName,
  getLevelDisplayName,
  getMostRecentSunday,
  getTodayDateInputValue,
  isValidLevel,
  normalizeSessionDate,
  toDateInputValue,
} from '@/lib/sunday-school-class'

describe('Sunday School class helpers', () => {
  describe('LEVEL_ORDER', () => {
    it('runs Pre-K through 12th grade', () => {
      expect(LEVEL_ORDER).toHaveLength(14)
      expect(LEVEL_ORDER[0]).toBe('PRE_K')
      expect(LEVEL_ORDER[1]).toBe('KINDERGARTEN')
      expect(LEVEL_ORDER[LEVEL_ORDER.length - 1]).toBe('GRADE_12')
    })

    it('has a display name for every level', () => {
      for (const level of LEVEL_ORDER) {
        expect(getLevelDisplayName(level)).toBeTruthy()
      }
    })
  })

  describe('isValidLevel', () => {
    it('accepts real levels', () => {
      expect(isValidLevel('GRADE_7')).toBe(true)
      expect(isValidLevel('PRE_K')).toBe(true)
    })

    it('rejects anything else', () => {
      // GRADE_6_PLUS belongs to the prep-side SundaySchoolGrade enum
      expect(isValidLevel('GRADE_6_PLUS')).toBe(false)
      expect(isValidLevel('GRADE_13')).toBe(false)
      expect(isValidLevel('')).toBe(false)
      expect(isValidLevel(null)).toBe(false)
      expect(isValidLevel(3)).toBe(false)
    })
  })

  describe('normalizeSessionDate', () => {
    it('leaves a plain YYYY-MM-DD at midnight UTC', () => {
      const date = normalizeSessionDate('2026-08-09')
      expect(date.toISOString()).toBe('2026-08-09T00:00:00.000Z')
    })

    it('truncates a full timestamp to its UTC day', () => {
      const date = normalizeSessionDate('2026-08-09T18:45:12.000Z')
      expect(date.toISOString()).toBe('2026-08-09T00:00:00.000Z')
    })

    it('makes the same calendar day collide, so a session is unique per date', () => {
      const morning = normalizeSessionDate('2026-08-09T09:00:00.000Z')
      const evening = normalizeSessionDate('2026-08-09T21:30:00.000Z')
      expect(morning.getTime()).toBe(evening.getTime())
    })

    it('rejects an unparseable date', () => {
      expect(() => normalizeSessionDate('not-a-date')).toThrow('Invalid session date')
    })
  })

  describe('getMostRecentSunday', () => {
    it('returns the same day when given a Sunday', () => {
      // 2026-08-09 is a Sunday
      const sunday = getMostRecentSunday(new Date(2026, 7, 9, 14, 30))
      expect(toDateInputValue(sunday)).toBe('2026-08-09')
    })

    it('walks back to the previous Sunday mid-week', () => {
      // 2026-08-12 is a Wednesday
      const sunday = getMostRecentSunday(new Date(2026, 7, 12, 8, 0))
      expect(toDateInputValue(sunday)).toBe('2026-08-09')
    })

    it('crosses a month boundary', () => {
      // 2026-08-01 is a Saturday; the Sunday before is 2026-07-26
      const sunday = getMostRecentSunday(new Date(2026, 7, 1, 23, 59))
      expect(toDateInputValue(sunday)).toBe('2026-07-26')
    })

    it('lands at midnight UTC so it matches stored session dates', () => {
      const sunday = getMostRecentSunday(new Date(2026, 7, 12))
      expect(sunday.toISOString()).toBe('2026-08-09T00:00:00.000Z')
    })
  })

  describe('getTodayDateInputValue', () => {
    it('formats the local calendar day, not the UTC one', () => {
      // Late evening local time — the UTC date may already be tomorrow, but
      // the date picker should still cap at the viewer's today
      const local = new Date(2026, 7, 12, 23, 30)
      expect(getTodayDateInputValue(local)).toBe('2026-08-12')
    })

    it('zero-pads single-digit months and days', () => {
      expect(getTodayDateInputValue(new Date(2026, 0, 5))).toBe('2026-01-05')
    })
  })

  describe('getChildFullName', () => {
    it('joins first and last name', () => {
      expect(getChildFullName({ firstName: 'Mina', lastName: 'Girgis' })).toBe('Mina Girgis')
    })
  })
})
