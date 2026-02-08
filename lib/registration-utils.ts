import { randomBytes } from 'crypto'

// Alphanumeric characters without confusable ones (0/O, 1/I/L)
const ALPHANUMERIC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Generates a unique invite code with format: SP-XXXXXXXX
 * Uses crypto-safe random generation
 * Excludes confusable characters (0/O, 1/I/L)
 */
export function generateInviteCode(): string {
  const bytes = randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += ALPHANUMERIC[bytes[i] % ALPHANUMERIC.length]
  }
  return `SP-${code}`
}

/**
 * Validates if an invite code is currently valid
 * Checks: active status, expiration date, usage count
 */
export function isInviteCodeValid(inviteCode: {
  isActive: boolean
  expiresAt: Date | null
  usageCount: number
  maxUses: number
}): { valid: boolean; reason?: string } {
  if (!inviteCode.isActive) {
    return { valid: false, reason: 'Code has been revoked' }
  }

  if (inviteCode.expiresAt && new Date() > inviteCode.expiresAt) {
    return { valid: false, reason: 'Code has expired' }
  }

  if (inviteCode.maxUses > 0 && inviteCode.usageCount >= inviteCode.maxUses) {
    return { valid: false, reason: 'Code has reached maximum usage' }
  }

  return { valid: true }
}

/**
 * Generates a temporary password for new users
 * 12 characters with mix of uppercase, lowercase, numbers, and symbols
 */
export function generateTempPassword(): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lowercase = 'abcdefghjkmnpqrstuvwxyz'
  const numbers = '23456789'
  const symbols = '!@#$%^&*'
  const all = uppercase + lowercase + numbers + symbols

  const bytes = randomBytes(12)
  let password = ''

  // Ensure at least one of each character type
  password += uppercase[bytes[0] % uppercase.length]
  password += lowercase[bytes[1] % lowercase.length]
  password += numbers[bytes[2] % numbers.length]
  password += symbols[bytes[3] % symbols.length]

  // Fill the rest randomly
  for (let i = 4; i < 12; i++) {
    password += all[bytes[i] % all.length]
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

/**
 * Gets display label for StudentGrade enum
 */
export function getGradeDisplayName(grade: string): string {
  const displayNames: Record<string, string> = {
    GRADE_9: '9th Grade',
    GRADE_10: '10th Grade',
    GRADE_11: '11th Grade',
    GRADE_12: '12th Grade',
    COLLEGE_FRESHMAN: 'College Freshman',
    COLLEGE_SOPHOMORE: 'College Sophomore',
    COLLEGE_JUNIOR: 'College Junior',
    COLLEGE_SENIOR: 'College Senior',
    POST_COLLEGE: 'Post-College',
    OTHER: 'Other',
  }
  return displayNames[grade] || grade
}
