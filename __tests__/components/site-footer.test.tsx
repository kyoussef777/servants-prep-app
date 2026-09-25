import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/admin',
}))

import { SiteFooter } from '@/components/site-footer'

describe('SiteFooter', () => {
  it('links to the shared feedback page', () => {
    render(<SiteFooter />)

    expect(screen.getByRole('link', { name: 'Feedback' })).toHaveAttribute(
      'href',
      '/dashboard/servants/feedback'
    )
  })
})
