import { describe, expect, it } from 'vitest'
import { getPersonInitials } from '@/lib/person-name'

describe('getPersonInitials', () => {
  it('ignores clerical titles and uses the first and last meaningful names', () => {
    expect(getPersonInitials('Very Rev. Fr. Markos Ayoub')).toBe('MA')
    expect(getPersonInitials('Rev. Fr. Daniel Abdel-Maseih')).toBe('DA')
  })

  it('uses compact initials for ordinary and single-word names', () => {
    expect(getPersonInitials('Joshua Kaisar')).toBe('JK')
    expect(getPersonInitials('Mina')).toBe('M')
  })

  it('provides a fallback for an empty name', () => {
    expect(getPersonInitials(null)).toBe('??')
    expect(getPersonInitials('   ')).toBe('??')
  })
})
