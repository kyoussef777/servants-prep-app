import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  findFirst: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditEvent: {
      deleteMany: mocks.deleteMany,
      findFirst: mocks.findFirst,
    },
  },
}))

import {
  getAuditRetentionCutoff,
  getAuditRetentionPolicy,
  pruneAuditEvents,
} from '@/lib/audit-retention'

describe('audit retention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    mocks.deleteMany.mockResolvedValue({ count: 0 })
    mocks.findFirst.mockResolvedValue(null)
  })

  it('keeps activity for no more than two hours', () => {
    vi.stubEnv('AUDIT_RETENTION_DAYS', '365')

    expect(getAuditRetentionPolicy().hours).toBe(2)
    expect(getAuditRetentionPolicy()).not.toHaveProperty('days')
    expect(getAuditRetentionCutoff(new Date('2026-09-23T12:00:00Z'))).toEqual(
      new Date('2026-09-23T10:00:00Z')
    )
  })

  it('removes events older than the retention window', async () => {
    mocks.deleteMany.mockResolvedValueOnce({ count: 12 })

    const result = await pruneAuditEvents({
      now: new Date('2026-09-23T12:00:00Z'),
      hours: 2,
      maxEvents: 50_000,
    })

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date('2026-09-23T10:00:00Z') } },
    })
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ skip: 50_000 }))
    expect(result.deletedCount).toBe(12)
  })

  it('removes rows beyond the maximum event count', async () => {
    const boundary = { id: 'event-boundary', createdAt: new Date('2026-08-01T00:00:00Z') }
    mocks.findFirst.mockResolvedValue(boundary)
    mocks.deleteMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 250 })

    const result = await pruneAuditEvents({
      now: new Date('2026-09-21T00:00:00Z'),
      hours: 2,
      maxEvents: 50_000,
    })

    expect(mocks.deleteMany).toHaveBeenNthCalledWith(2, {
      where: {
        OR: [
          { createdAt: { lt: boundary.createdAt } },
          { createdAt: boundary.createdAt, id: { lte: boundary.id } },
        ],
      },
    })
    expect(result.overflowCount).toBe(250)
  })
})
