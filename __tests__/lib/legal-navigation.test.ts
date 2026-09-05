import { describe, expect, it } from 'vitest'
import {
  getLegalReturnLabel,
  getSafeLegalReturnPath,
  isLegalPath,
} from '@/lib/legal-navigation'

describe('legal navigation', () => {
  it('recognizes public and Sunday School legal routes', () => {
    expect(isLegalPath('/privacy')).toBe(true)
    expect(isLegalPath('/terms')).toBe(true)
    expect(isLegalPath('/dashboard/servants/privacy')).toBe(true)
    expect(isLegalPath('/dashboard/servants/terms')).toBe(true)
    expect(isLegalPath('/dashboard/servants/users')).toBe(false)
  })

  it('returns to the previous page within the active mode', () => {
    expect(getSafeLegalReturnPath('/dashboard/servants/users?role=SERVANT', true)).toBe(
      '/dashboard/servants/users?role=SERVANT'
    )
    expect(getSafeLegalReturnPath('/dashboard/admin/users', false)).toBe(
      '/dashboard/admin/users'
    )
  })

  it('rejects cross-mode, legal, and external return destinations', () => {
    expect(getSafeLegalReturnPath('/dashboard/admin/users', true)).toBeNull()
    expect(getSafeLegalReturnPath('/dashboard/servants/users', false)).toBeNull()
    expect(getSafeLegalReturnPath('/privacy', false)).toBeNull()
    expect(getSafeLegalReturnPath('//example.com', false)).toBeNull()
    expect(getSafeLegalReturnPath('https://example.com', false)).toBeNull()
  })

  it('names the page the user will return to', () => {
    expect(getLegalReturnLabel('/dashboard/servants/users?role=SERVANT', true)).toBe('Users')
    expect(getLegalReturnLabel('/dashboard/servants/classes/class-123', true)).toBe('Classes')
    expect(getLegalReturnLabel('/dashboard/admin/curriculum', false)).toBe('Curriculum')
    expect(getLegalReturnLabel('/settings', false)).toBe('My Account')
    expect(getLegalReturnLabel(null, true)).toBe('Sunday School')
    expect(getLegalReturnLabel(null, false)).toBe('Dashboard')
  })
})
