import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/useAdminGuard', () => ({
  useAdminGuard: () => ({
    session: { user: { id: 'mentor-1', role: 'MENTOR' } },
    status: 'authenticated',
  }),
}))

import MyMenteesPage from '@/app/dashboard/mentor/my-mentees/page'

describe('My Mentees page layout', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the shared canvas and current floating-surface design language', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }))

    const { container } = render(<MyMenteesPage />)

    expect(await screen.findByText('My Mentees')).toBeInTheDocument()
    expect(screen.getByText('No mentees assigned yet')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass('bg-[var(--app-canvas)]')
    expect(container.querySelector('.max-w-7xl')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="card"]')).toHaveClass(
      'rounded-2xl',
      'backdrop-blur-xl',
      'shadow-sm'
    )
  })
})
