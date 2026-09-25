import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserRole } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  pathname: '/dashboard/servants',
  push: vi.fn(),
}))

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
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}))

vi.mock('@/components/notifications/notification-bell', () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
}))

import { Navbar } from '@/components/navbar'

describe('Navbar with long names', () => {
  beforeEach(() => {
    mocks.pathname = '/dashboard/servants'
    mocks.push.mockClear()
  })

  it('hides an oversized identity label and uses meaningful avatar initials', () => {
    render(<Navbar />)

    expect(screen.getByRole('navigation')).toHaveClass('flex-none')
    expect(screen.getByRole('navigation').firstElementChild?.firstElementChild).toHaveClass(
      'h-16',
      'min-h-16'
    )

    const name = screen.getByText('Rev. Fr. Daniel Abdel-Maseih')
    expect(name.parentElement).toHaveClass('hidden')
    expect(name.parentElement).not.toHaveClass('2xl:flex')
    expect(screen.getByText('DA')).toBeInTheDocument()
    expect(screen.queryByText('RFDA')).not.toBeInTheDocument()
  })

  it('offers priests the read-only servant attendance page in Sunday School mode', async () => {
    const user = userEvent.setup()
    render(<Navbar />)

    await user.click(screen.getByRole('button', { name: /more/i }))

    expect(await screen.findByRole('menuitem', { name: 'Servant attendance' })).toHaveAttribute(
      'href',
      '/dashboard/servants/servant-attendance'
    )
  })

  it('puts the logo-based service switcher in the profile menu', async () => {
    const user = userEvent.setup()
    render(<Navbar />)

    await user.click(screen.getByRole('button', { name: 'Open profile menu' }))

    expect(await screen.findByText('Services')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Servants Prep logo' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Sunday School logo' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Switch to Servants Prep' })).toHaveAttribute(
      'href',
      '/dashboard/admin'
    )
    expect(screen.getByText('Current service')).toBeInTheDocument()
  })

  it('offers the same logo-based switcher from Servants Prep', async () => {
    mocks.pathname = '/dashboard/admin'
    const user = userEvent.setup()
    render(<Navbar />)

    await user.click(screen.getByRole('button', { name: 'Open profile menu' }))

    expect(screen.getByRole('img', { name: 'Servants Prep logo' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Sunday School logo' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Switch to Sunday School' })).toHaveAttribute(
      'href',
      '/dashboard/servants'
    )
  })
})
