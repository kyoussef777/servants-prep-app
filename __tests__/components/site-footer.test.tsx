import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/admin',
}))

import { SiteFooter } from '@/components/site-footer'

describe('SiteFooter', () => {
  it('uses the shared application canvas and floating surface styling', () => {
    const { container } = render(<SiteFooter />)

    const footer = container.querySelector('footer')
    const surface = footer?.firstElementChild

    expect(footer).toHaveClass('bg-[var(--app-canvas)]')
    expect(surface).toHaveClass(
      'max-w-7xl',
      'rounded-2xl',
      'backdrop-blur-xl',
      'shadow-sm'
    )

    expect(screen.getByRole('link', { name: 'Feedback' })).toHaveAttribute(
      'href',
      '/dashboard/servants/feedback'
    )
  })
})
