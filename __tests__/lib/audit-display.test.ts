import { describe, expect, it } from 'vitest'
import {
  auditActionSummary,
  auditMetadataEntries,
  auditReasonLabel,
} from '@/lib/audit-display'

describe('audit display helpers', () => {
  it('turns technical View as activity into a plain-language summary', () => {
    expect(auditActionSummary({
      action: 'ADMIN_VIEW_AS_STARTED',
      result: 'SUCCESS',
      reason: null,
      entityType: 'User',
      entityId: 'user-2',
      metadata: { readOnly: true },
      target: { name: 'Liza Hanna', email: 'liza@example.com' },
    })).toBe('Started viewing as Liza Hanna')
  })

  it('uses retained metadata to name a deleted user', () => {
    expect(auditActionSummary({
      action: 'user.delete',
      result: 'SUCCESS',
      reason: null,
      entityType: 'User',
      entityId: 'deleted-user',
      metadata: { targetName: 'Deleted Person', targetEmail: 'deleted@example.com' },
      target: null,
    })).toBe('Deleted user account for Deleted Person')
  })

  it('explains coded reasons and formats metadata labels and values', () => {
    expect(auditReasonLabel('INVALID_CREDENTIALS')).toBe(
      'The email or password was incorrect.'
    )
    expect(auditMetadataEntries({
      provider: 'credentials',
      readOnly: true,
      grantedTags: ['SUPER_ADMIN', 'SUNDAY_SCHOOL_SERVANT'],
    })).toEqual([
      { label: 'Sign-in method', value: 'Email and password' },
      { label: 'Read-only session', value: 'Yes' },
      { label: 'Roles added', value: 'Super Admin, Sunday School Servant' },
    ])
  })
})
