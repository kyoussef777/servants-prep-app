import { describe, expect, it } from 'vitest'
import { sanitizeAuditMetadata } from '@/lib/audit'

describe('sanitizeAuditMetadata', () => {
  it('removes secrets recursively before audit metadata is returned', () => {
    expect(sanitizeAuditMetadata({
      provider: 'credentials',
      password: 'not-safe',
      nested: { accessToken: 'not-safe', status: 'changed' },
    })).toEqual({
      provider: 'credentials',
      nested: { status: 'changed' },
    })
  })
})
