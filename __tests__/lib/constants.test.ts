import { describe, it, expect } from 'vitest'
import { SECTION_DISPLAY_NAMES } from '@/lib/constants'

// These are the ExamSectionType enum values from Prisma
const ALL_SECTIONS = [
  'BIBLE_STUDIES',
  'DOGMA',
  'COMPARATIVE_THEOLOGY',
  'RITUAL_THEOLOGY_SACRAMENTS',
  'CHURCH_HISTORY_COPTIC_HERITAGE',
  'SPIRITUALITY_OF_SERVANT',
  'PSYCHOLOGY_METHODOLOGY',
  'MISCELLANEOUS',
] as const

describe('SECTION_DISPLAY_NAMES', () => {
  it('should have a display name for every exam section type', () => {
    for (const section of ALL_SECTIONS) {
      expect(SECTION_DISPLAY_NAMES[section]).toBeDefined()
      expect(typeof SECTION_DISPLAY_NAMES[section]).toBe('string')
      expect(SECTION_DISPLAY_NAMES[section].length).toBeGreaterThan(0)
    }
  })

  it('should have exactly 8 section entries', () => {
    expect(Object.keys(SECTION_DISPLAY_NAMES)).toHaveLength(8)
  })

  it('should map BIBLE_STUDIES correctly', () => {
    expect(SECTION_DISPLAY_NAMES.BIBLE_STUDIES).toBe('Bible Studies')
  })

  it('should map DOGMA correctly', () => {
    expect(SECTION_DISPLAY_NAMES.DOGMA).toBe('Dogma')
  })

  it('should map COMPARATIVE_THEOLOGY correctly', () => {
    expect(SECTION_DISPLAY_NAMES.COMPARATIVE_THEOLOGY).toBe('Comparative Theology')
  })

  it('should map RITUAL_THEOLOGY_SACRAMENTS correctly', () => {
    expect(SECTION_DISPLAY_NAMES.RITUAL_THEOLOGY_SACRAMENTS).toBe('Ritual Theology & Sacraments')
  })

  it('should map CHURCH_HISTORY_COPTIC_HERITAGE correctly', () => {
    expect(SECTION_DISPLAY_NAMES.CHURCH_HISTORY_COPTIC_HERITAGE).toBe('Church History & Coptic Heritage')
  })

  it('should map SPIRITUALITY_OF_SERVANT correctly', () => {
    expect(SECTION_DISPLAY_NAMES.SPIRITUALITY_OF_SERVANT).toBe('Spirituality of the Servant')
  })

  it('should map PSYCHOLOGY_METHODOLOGY correctly', () => {
    expect(SECTION_DISPLAY_NAMES.PSYCHOLOGY_METHODOLOGY).toBe('Psychology & Methodology')
  })

  it('should map MISCELLANEOUS correctly', () => {
    expect(SECTION_DISPLAY_NAMES.MISCELLANEOUS).toBe('Miscellaneous')
  })

  it('should return undefined for an unknown section key', () => {
    expect(SECTION_DISPLAY_NAMES['NONEXISTENT']).toBeUndefined()
  })
})
