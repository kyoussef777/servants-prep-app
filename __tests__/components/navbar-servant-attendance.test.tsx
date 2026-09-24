import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserRole } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'servant-1',
        name: 'Sunday School Servant',
        email: 'servant@example.com',
        role: UserRole.SERVANT,
        profileImageUrl: null,
        sundaySchool: { hasAccess: true, isCoordinator: false },
      },
    },
  }),
  signOut: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/servants',
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}))

vi.mock('@/components/notifications/notification-bell', () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
}))

import { Navbar } from '@/components/navbar'

describe('Navbar for a Sunday School servant', () => {
  it('shows servant attendance even when the servant is not a coordinator', async () => {
    const user = userEvent.setup()
    render(<Navbar />)

    await user.click(screen.getByRole('button', { name: /more/i }))

    expect(await screen.findByRole('menuitem', { name: 'Servant attendance' })).toHaveAttribute(
      'href',
      '/dashboard/servants/servant-attendance'
    )
  })
})
