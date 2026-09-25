import { fireEvent, render, waitFor } from '@testing-library/react'
import { UserRole } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'admin-1',
        name: 'Admin User',
        email: 'admin@example.com',
        role: UserRole.SUPER_ADMIN,
        profileImageUrl: null,
        sundaySchool: { hasAccess: true },
      },
    },
  }),
  signOut: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/admin',
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}))

vi.mock('@/components/notifications/notification-bell', () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
}))

import { Navbar } from '@/components/navbar'

describe('Navbar scroll motion', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024, writable: true })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0)
    )
    vi.stubGlobal('cancelAnimationFrame', (frame: number) => window.clearTimeout(frame))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('compacts while scrolling down and expands while scrolling up', async () => {
    const { container } = render(<Navbar />)
    const nav = container.querySelector('nav')
    const floatingPanel = nav?.firstElementChild

    expect(nav).toHaveAttribute('data-scroll-state', 'expanded')
    expect(nav).toHaveAttribute('data-page-position', 'top')
    expect(nav).toHaveClass('bg-[var(--app-canvas)]')
    expect(floatingPanel).not.toHaveClass('overflow-hidden')

    window.scrollY = 120
    fireEvent.scroll(window)
    await waitFor(() => {
      expect(nav).toHaveAttribute('data-scroll-state', 'compact')
      expect(nav).toHaveAttribute('data-page-position', 'scrolled')
      expect(nav).toHaveClass('bg-transparent')
      expect(nav).not.toHaveClass('bg-[var(--app-canvas)]')
    })

    window.scrollY = 60
    fireEvent.scroll(window)
    await waitFor(() => {
      expect(nav).toHaveAttribute('data-scroll-state', 'expanded')
      expect(nav).toHaveAttribute('data-page-position', 'scrolled')
      expect(nav).toHaveClass('bg-transparent')
    })

    window.scrollY = 0
    fireEvent.scroll(window)
    await waitFor(() => {
      expect(nav).toHaveAttribute('data-page-position', 'top')
      expect(nav).toHaveClass('bg-[var(--app-canvas)]')
    })
  })

  it('keeps service switching in the profile menu on mobile', () => {
    const { container } = render(<Navbar />)
    const menu = container.querySelector('#mobile-navigation-menu')
    const openButton = container.querySelector('button[aria-label="Open navigation menu"]')

    expect(menu).toHaveAttribute('aria-hidden', 'true')
    expect(menu).toHaveClass('grid-rows-[0fr]', 'opacity-0')
    expect(openButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(openButton!)

    const closeButton = container.querySelector('button[aria-label="Close navigation menu"]')
    expect(menu).toHaveAttribute('aria-hidden', 'false')
    expect(menu).toHaveClass('grid-rows-[1fr]', 'opacity-100')
    expect(closeButton).toHaveAttribute('aria-expanded', 'true')
    expect(menu).not.toHaveTextContent('Switch portal view')
  })

  it('keeps the navbar expanded while scrolling on mobile', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390, writable: true })
    const { container } = render(<Navbar />)
    const nav = container.querySelector('nav')

    window.scrollY = 120
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(nav).toHaveAttribute('data-scroll-state', 'expanded')
    })
  })
})
