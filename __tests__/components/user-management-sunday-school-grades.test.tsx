import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { RoleTag, SundaySchoolLevel, UserRole } from '@prisma/client'

vi.mock('@/hooks/useAdminGuard', () => ({
  useAdminGuard: () => ({
    status: 'authenticated',
    session: { user: { id: 'admin-1', role: UserRole.SUPER_ADMIN } },
  }),
}))

import UsersPage from '@/app/dashboard/admin/users/page'

describe('user management Sunday School assignments', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([
        {
          id: 'servant-1',
          name: 'Mina Servant',
          email: 'mina@example.com',
          phone: null,
          role: UserRole.SERVANT,
          roleAssignments: [{ tag: RoleTag.SUNDAY_SCHOOL_SERVANT }],
          sundaySchoolServing: [
            {
              class: { level: SundaySchoolLevel.GRADE_6 },
              ageGroup: null,
            },
          ],
          isDisabled: false,
          _count: { mentoredStudents: 0 },
        },
      ]),
    }))
  })

  it('shows assigned grades in their own column without the redundant badge', async () => {
    render(<UsersPage />)

    expect(await screen.findByRole('columnheader', { name: 'Sunday School grades' }))
      .toBeInTheDocument()

    await waitFor(() => {
      const row = screen.getByRole('row', { name: /Mina Servant/ })
      expect(within(row).getByText('6th Grade')).toBeInTheDocument()
    })

    expect(screen.queryByText('Assigned to Sunday School')).not.toBeInTheDocument()
    expect(screen.getAllByText('Sunday School Servant').length).toBeGreaterThan(0)
  })
})
