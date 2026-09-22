import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  push: vi.fn(),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'user-1' } } }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('swr', () => ({
  default: () => ({
    data: { notifications: [], unreadCount: 3, nextCursor: null },
    mutate: mocks.mutate,
  }),
}))

import { NotificationBell } from '@/components/notifications/notification-bell'

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fills the selected bell without moving or resizing it', async () => {
    const user = userEvent.setup()
    render(<NotificationBell />)

    const button = screen.getByRole('button', { name: 'Notifications (3 unread)' })
    const icon = screen.getByTestId('notification-bell-icon')

    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(icon).not.toHaveClass('fill-current')

    await user.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveClass('bg-accent', 'text-primary')
    expect(icon).toHaveClass('fill-current')
    expect(icon).not.toHaveClass('-rotate-12', 'scale-110')
    expect(button).not.toHaveClass('scale-105')
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toHaveClass(
      'animate-in',
      'fade-in-0'
    )
  })
})
