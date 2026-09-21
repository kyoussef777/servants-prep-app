import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SundaySchoolAuthority, SundaySchoolLevel, UserRole } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  useSundaySchoolAgeGroups: vi.fn(),
  mutate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/hooks/useSundaySchoolGuard', () => ({
  useSundaySchoolGuard: () => ({
    status: 'authenticated',
    session: {
      user: {
        id: 'admin-1',
        role: UserRole.SUPER_ADMIN,
        sundaySchool: { hasAccess: true, isCoordinator: true },
      },
    },
  }),
}))

vi.mock('@/lib/swr', () => ({
  useSundaySchoolAgeGroups: mocks.useSundaySchoolAgeGroups,
  usePriestOverseers: () => ({ data: [], error: null, isLoading: false }),
}))

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}))

import SundaySchoolAgeGroupsPage from '@/app/dashboard/servants/age-groups/page'

describe('Sunday School age groups page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mutate.mockResolvedValue(undefined)
    mocks.useSundaySchoolAgeGroups.mockReturnValue({
      data: [
        {
          id: 'middle-school',
          name: 'Middle School',
          levels: [SundaySchoolLevel.GRADE_6, SundaySchoolLevel.GRADE_7],
          sortOrder: 0,
          isActive: true,
          overseerId: null,
          overseer: null,
          assignments: [],
        },
      ],
      isLoading: false,
      mutate: mocks.mutate,
    })
  })

  it('lets a super admin assign an age-group coordinator from the edit dialog', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            id: 'servant-1',
            name: 'Mina Servant',
            email: 'mina@example.com',
            role: UserRole.SERVANT,
          },
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 'assignment-1' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<SundaySchoolAgeGroupsPage />)

    await user.click(screen.getByRole('button', { name: 'Edit Middle School' }))
    const coordinatorSelect = await screen.findByLabelText('Age-group coordinators')
    await user.selectOptions(coordinatorSelect, 'servant-1')
    await user.click(screen.getByRole('button', { name: 'Assign' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/sunday-school/assignable-servants'
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/sunday-school/servant-assignments',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'servant-1',
          ageGroupId: 'middle-school',
          authority: SundaySchoolAuthority.COORDINATOR,
        }),
      })
    )
    expect(mocks.mutate).toHaveBeenCalled()
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'Age-group coordinator assigned',
      expect.objectContaining({ description: expect.any(String) })
    )
  })
})
