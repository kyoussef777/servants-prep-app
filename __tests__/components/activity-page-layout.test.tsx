import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ActivityPage from '@/app/dashboard/admin/activity/page'

describe('Activity page layout', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the same full-page background as the navbar surround', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [],
        page: 1,
        total: 0,
        totalPages: 1,
        retention: { hours: 2, maxEvents: 5000 },
      }),
    }))

    const { container } = render(<ActivityPage />)
    const page = container.firstElementChild

    expect(page).toHaveClass('min-h-screen', 'bg-[var(--app-canvas)]')
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  })
})
