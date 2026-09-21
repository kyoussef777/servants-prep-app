import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ prune: vi.fn() }))
vi.mock('@/lib/audit-retention', () => ({ pruneAuditEvents: mocks.prune }))

import { GET } from '@/app/api/cron/audit-retention/route'

describe('audit retention cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    mocks.prune.mockResolvedValue({
      cutoff: '2025-09-21T00:00:00.000Z',
      expiredCount: 4,
      overflowCount: 0,
      deletedCount: 4,
      days: 365,
      maxEvents: 50_000,
    })
  })

  it('rejects requests without the configured bearer secret', async () => {
    const response = await GET(new Request('http://localhost/api/cron/audit-retention'))

    expect(response.status).toBe(401)
    expect(mocks.prune).not.toHaveBeenCalled()
  })

  it('runs the cleanup with the configured bearer secret', async () => {
    const response = await GET(new Request('http://localhost/api/cron/audit-retention', {
      headers: { authorization: 'Bearer test-secret' },
    }))

    expect(response.status).toBe(200)
    expect(mocks.prune).toHaveBeenCalledOnce()
    expect(await response.json()).toEqual(expect.objectContaining({
      success: true,
      deletedCount: 4,
    }))
  })
})
