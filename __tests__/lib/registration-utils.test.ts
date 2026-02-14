import { describe, it, expect } from 'vitest'
import {
  generateInviteCode,
  isInviteCodeValid,
  generateTempPassword,
  getGradeDisplayName,
} from '@/lib/registration-utils'

describe('generateInviteCode', () => {
  it('should have SP- prefix', () => {
    const code = generateInviteCode()
    expect(code).toMatch(/^SP-/)
  })

  it('should have 8 characters after prefix', () => {
    const code = generateInviteCode()
    expect(code).toMatch(/^SP-[A-Z0-9]{8}$/)
  })

  it('should match format SP-[A-Z0-9]{8} with only non-confusable characters', () => {
    // Generate several codes and verify none contain confusable chars
    for (let i = 0; i < 20; i++) {
      const code = generateInviteCode()
      const suffix = code.slice(3)
      expect(suffix).not.toMatch(/[0OIL1]/)
    }
  })

  it('should generate unique codes across multiple calls', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 50; i++) {
      codes.add(generateInviteCode())
    }
    expect(codes.size).toBe(50)
  })
})

describe('isInviteCodeValid', () => {
  it('should return valid for an active, non-expired code with uses remaining', () => {
    const result = isInviteCodeValid({
      isActive: true,
      expiresAt: new Date(Date.now() + 86400000), // tomorrow
      usageCount: 0,
      maxUses: 10,
    })
    expect(result).toEqual({ valid: true })
  })

  it('should return invalid when code is inactive', () => {
    const result = isInviteCodeValid({
      isActive: false,
      expiresAt: null,
      usageCount: 0,
      maxUses: 0,
    })
    expect(result).toEqual({ valid: false, reason: 'Code has been revoked' })
  })

  it('should return invalid when code has expired', () => {
    const result = isInviteCodeValid({
      isActive: true,
      expiresAt: new Date(Date.now() - 86400000), // yesterday
      usageCount: 0,
      maxUses: 0,
    })
    expect(result).toEqual({ valid: false, reason: 'Code has expired' })
  })

  it('should return invalid when max uses reached', () => {
    const result = isInviteCodeValid({
      isActive: true,
      expiresAt: null,
      usageCount: 10,
      maxUses: 10,
    })
    expect(result).toEqual({ valid: false, reason: 'Code has reached maximum usage' })
  })

  it('should return valid when maxUses is 0 (unlimited)', () => {
    const result = isInviteCodeValid({
      isActive: true,
      expiresAt: null,
      usageCount: 999,
      maxUses: 0,
    })
    expect(result).toEqual({ valid: true })
  })

  it('should return valid when expiresAt is null (no expiration)', () => {
    const result = isInviteCodeValid({
      isActive: true,
      expiresAt: null,
      usageCount: 5,
      maxUses: 10,
    })
    expect(result).toEqual({ valid: true })
  })

  it('should return valid when usageCount is below maxUses', () => {
    const result = isInviteCodeValid({
      isActive: true,
      expiresAt: null,
      usageCount: 9,
      maxUses: 10,
    })
    expect(result).toEqual({ valid: true })
  })

  it('should check inactive before expiration (priority order)', () => {
    const result = isInviteCodeValid({
      isActive: false,
      expiresAt: new Date(Date.now() - 86400000),
      usageCount: 10,
      maxUses: 10,
    })
    // Should return revoked, not expired
    expect(result.reason).toBe('Code has been revoked')
  })

  it('should check expiration before max uses', () => {
    const result = isInviteCodeValid({
      isActive: true,
      expiresAt: new Date(Date.now() - 86400000),
      usageCount: 10,
      maxUses: 10,
    })
    // Should return expired, not max usage
    expect(result.reason).toBe('Code has expired')
  })
})

describe('generateTempPassword', () => {
  it('should generate a 12-character password', () => {
    const password = generateTempPassword()
    expect(password).toHaveLength(12)
  })

  it('should generate unique passwords across calls', () => {
    const passwords = new Set<string>()
    for (let i = 0; i < 20; i++) {
      passwords.add(generateTempPassword())
    }
    expect(passwords.size).toBe(20)
  })

  it('should contain at least one uppercase letter', () => {
    // Run multiple times to account for shuffle randomness
    for (let i = 0; i < 10; i++) {
      const password = generateTempPassword()
      expect(password).toMatch(/[A-Z]/)
    }
  })

  it('should contain at least one lowercase letter', () => {
    for (let i = 0; i < 10; i++) {
      const password = generateTempPassword()
      expect(password).toMatch(/[a-z]/)
    }
  })

  it('should contain at least one digit', () => {
    for (let i = 0; i < 10; i++) {
      const password = generateTempPassword()
      expect(password).toMatch(/[0-9]/)
    }
  })

  it('should contain at least one symbol', () => {
    for (let i = 0; i < 10; i++) {
      const password = generateTempPassword()
      expect(password).toMatch(/[!@#$%^&*]/)
    }
  })
})

describe('getGradeDisplayName', () => {
  it('should return correct display name for all grade values', () => {
    expect(getGradeDisplayName('GRADE_9')).toBe('9th Grade')
    expect(getGradeDisplayName('GRADE_10')).toBe('10th Grade')
    expect(getGradeDisplayName('GRADE_11')).toBe('11th Grade')
    expect(getGradeDisplayName('GRADE_12')).toBe('12th Grade')
    expect(getGradeDisplayName('COLLEGE_FRESHMAN')).toBe('College Freshman')
    expect(getGradeDisplayName('COLLEGE_SOPHOMORE')).toBe('College Sophomore')
    expect(getGradeDisplayName('COLLEGE_JUNIOR')).toBe('College Junior')
    expect(getGradeDisplayName('COLLEGE_SENIOR')).toBe('College Senior')
    expect(getGradeDisplayName('POST_COLLEGE')).toBe('Post-College')
    expect(getGradeDisplayName('OTHER')).toBe('Other')
  })

  it('should return the raw value for unknown grades', () => {
    expect(getGradeDisplayName('UNKNOWN_GRADE')).toBe('UNKNOWN_GRADE')
  })
})
