import { render, screen } from '@testing-library/react'
import { UserRole } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'priest-1',
        name: 'Rev. Fr. Daniel Abdel-Maseih',
        email: 'daniel@example.com',
        role: UserRole.PRIEST,
        profileImageUrl: null,
        sundaySchool: { hasAccess: true },
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

describe('Navbar with long names', () => {
  it('keeps the identity compact and uses meaningful avatar initials', () => {
    render(<Navbar />)

    const name = screen.getByText('Rev. Fr. Daniel Abdel-Maseih')
    expect(name).toHaveClass('truncate')
    expect(name.parentElement).toHaveClass('max-w-40', '2xl:flex')
    expect(screen.getByText('DA')).toBeInTheDocument()
    expect(screen.queryByText('RFDA')).not.toBeInTheDocument()
  })
})
