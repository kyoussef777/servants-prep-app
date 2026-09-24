import { describe, expect, it } from 'vitest'
import { normalizeEmail, normalizeOptionalEmail } from '@/lib/email'

describe('email normalization', () => {
  it('trims and lowercases submitted email addresses', () => {
    expect(normalizeEmail('  Person.Name+Tag@Example.COM ')).toBe(
      'person.name+tag@example.com'
    )
  })

  it('returns an empty string for non-string values', () => {
    expect(normalizeEmail(undefined)).toBe('')
    expect(normalizeEmail(null)).toBe('')
  })

  it('returns null for an empty optional email', () => {
    expect(normalizeOptionalEmail('   ')).toBeNull()
    expect(normalizeOptionalEmail(' Parent@Example.COM ')).toBe('parent@example.com')
  })
})
