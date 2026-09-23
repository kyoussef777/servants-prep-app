import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditEventResult } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  pruneAuditEvents: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { auditEvent: { create: mocks.create } },
}))
vi.mock('@/lib/audit-retention', () => ({
  pruneAuditEvents: mocks.pruneAuditEvents,
}))

import { recordAuditEvent, sanitizeAuditMetadata } from '@/lib/audit'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.create.mockResolvedValue({ id: 'event-1' })
  mocks.pruneAuditEvents.mockResolvedValue({ deletedCount: 0 })
})

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

describe('recordAuditEvent', () => {
  it('enforces retention after recording new activity', async () => {
    await recordAuditEvent({
      action: 'USER_SIGNED_IN',
      entityType: 'User',
      result: AuditEventResult.SUCCESS,
    })

    expect(mocks.create).toHaveBeenCalledOnce()
    expect(mocks.pruneAuditEvents).toHaveBeenCalledOnce()
  })
})
