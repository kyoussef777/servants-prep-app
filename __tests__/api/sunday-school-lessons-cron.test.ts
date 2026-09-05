import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ ensure: vi.fn() }))
vi.mock('@/lib/sunday-school-lessons', () => ({ ensureSundaySchoolWeeklyLessons: mocks.ensure }))

import { GET } from '@/app/api/cron/sunday-school-lessons/route'

describe('weekly lesson cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    mocks.ensure.mockResolvedValue({ classes: 2, attempted: 16, created: 8 })
  })

  it('rejects missing or incorrect bearer credentials', async () => {
    expect((await GET(new Request('http://localhost/api/cron/sunday-school-lessons'))).status).toBe(401)
    expect((await GET(new Request('http://localhost/api/cron/sunday-school-lessons', {
      headers: { authorization: 'Bearer wrong' },
    }))).status).toBe(401)
    expect(mocks.ensure).not.toHaveBeenCalled()
  })

  it('runs the idempotent generator with the configured secret', async () => {
    const response = await GET(new Request('http://localhost/api/cron/sunday-school-lessons', {
      headers: { authorization: 'Bearer test-secret' },
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, classes: 2, attempted: 16, created: 8 })
    expect(mocks.ensure).toHaveBeenCalledOnce()
  })
})
