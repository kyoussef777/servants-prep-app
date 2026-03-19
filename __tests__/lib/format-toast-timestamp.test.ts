import { describe, it, expect } from 'vitest'
import { formatToastTimestamp } from '@/lib/utils'

describe('formatToastTimestamp', () => {
  it('should format a date with month, day, year, hour, and minute', () => {
    const date = new Date('2024-06-15T14:30:00')
    const result = formatToastTimestamp(date)

    expect(result).toContain('Jun')
    expect(result).toContain('15')
    expect(result).toContain('2024')
    // Should include time
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it('should use short month format', () => {
    const date = new Date('2024-12-25T10:00:00')
    const result = formatToastTimestamp(date)

    expect(result).toContain('Dec')
    expect(result).not.toContain('December')
  })

  it('should include 2-digit minute', () => {
    const date = new Date('2024-01-01T09:05:00')
    const result = formatToastTimestamp(date)

    // Minutes should be 2-digit (05)
    expect(result).toMatch(/:05/)
  })

  it('should use default (current date) when no argument provided', () => {
    const result = formatToastTimestamp()

    // Should be a non-empty string with the current year
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should produce consistent output for the same input', () => {
    const date = new Date('2024-03-10T16:45:00')
    const result1 = formatToastTimestamp(date)
    const result2 = formatToastTimestamp(date)

    expect(result1).toBe(result2)
  })

  it('should handle midnight', () => {
    const date = new Date('2024-07-04T00:00:00')
    const result = formatToastTimestamp(date)

    expect(result).toContain('Jul')
    expect(result).toContain('4')
    expect(result).toContain('2024')
    // Should show 12:00 AM
    expect(result).toMatch(/12:00/)
  })

  it('should handle noon', () => {
    const date = new Date('2024-07-04T12:00:00')
    const result = formatToastTimestamp(date)

    expect(result).toMatch(/12:00/)
  })
})
