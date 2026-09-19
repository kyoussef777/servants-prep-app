import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '@prisma/client'
import { defaultDashboardPath, ViewAsMode } from '@/components/view-as-mode'

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'bishoy',
        name: 'Bishoy Samy',
        email: 'bishoy@example.com',
        role: UserRole.MENTOR,
      },
      impersonating: {
        originalId: 'admin',
        originalName: 'Super Admin',
        originalEmail: 'admin@example.com',
        expiresAt: Date.now() + 60_000,
        readOnly: true,
      },
    },
    update: mocks.update,
  }),
}))

describe('ViewAsMode', () => {
  afterEach(() => {
    mocks.update.mockReset()
    mocks.refresh.mockReset()
    window.history.replaceState(window.history.state, '', '/')
  })

  it('maps each restored account role to its own dashboard', () => {
    expect(defaultDashboardPath(UserRole.SUPER_ADMIN)).toBe('/dashboard/admin')
    expect(defaultDashboardPath(UserRole.PRIEST)).toBe('/dashboard/admin')
    expect(defaultDashboardPath(UserRole.SERVANT_PREP)).toBe('/dashboard/admin')
    expect(defaultDashboardPath(UserRole.MENTOR)).toBe('/dashboard/mentor')
    expect(defaultDashboardPath(UserRole.SERVANT)).toBe('/dashboard/servants')
    expect(defaultDashboardPath(UserRole.STUDENT)).toBe('/dashboard/student')
    expect(defaultDashboardPath(UserRole.PARENT)).toBe('/dashboard/parent')
  })

  it('returns to the restored super admin dashboard after stopping View as', async () => {
    window.history.replaceState(window.history.state, '', '/dashboard/mentor')
    mocks.update.mockResolvedValue({
      user: { id: 'admin', role: UserRole.SUPER_ADMIN },
      impersonating: null,
    })

    render(<ViewAsMode />)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith({ impersonate: null })
      expect(window.location.pathname).toBe('/dashboard/admin')
      expect(mocks.refresh).toHaveBeenCalledOnce()
    })
  })
})
