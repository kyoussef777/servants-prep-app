import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SundaySchoolLevel } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/hooks/useSundaySchoolGuard', () => ({
  useSundaySchoolGuard: () => ({ status: 'authenticated' }),
}))

vi.mock('@/lib/swr', () => ({
  useSundaySchoolClasses: () => ({
    data: [
      {
        id: 'class-1',
        name: 'Middle School',
        level: SundaySchoolLevel.GRADE_6,
        academicYearId: 'year-1',
        isActive: true,
        canCoordinate: true,
        assignments: [],
        _count: { children: 12, sessions: 3 },
      },
    ],
    isLoading: false,
    mutate: mocks.mutate,
  }),
  useSundaySchoolDashboard: () => ({
    data: { standing: { isAdmin: true }, ageGroups: [] },
  }),
}))

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}))

import SundaySchoolClassesPage from '@/app/dashboard/servants/classes/page'

describe('Sunday School classes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mutate.mockResolvedValue(undefined)
  })

  it('lets a coordinator rename a class', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'class-1', name: 'Middle School Boys' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<SundaySchoolClassesPage />)

    await user.click(screen.getByRole('button', { name: 'Edit Middle School name' }))
    const nameInput = screen.getByRole('textbox', { name: 'Class name' })
    await user.clear(nameInput)
    await user.type(nameInput, '  Middle School Boys  ')
    await user.click(screen.getByRole('button', { name: 'Save name' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/sunday-school/classes/class-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Middle School Boys' }),
        })
      )
    })
    expect(mocks.mutate).toHaveBeenCalled()
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'Class name updated',
      expect.objectContaining({ description: expect.any(String) })
    )
  })

  it('offers one combined College & Grad level when creating a class', async () => {
    const user = userEvent.setup()

    render(<SundaySchoolClassesPage />)

    await user.click(screen.getByRole('button', { name: 'New class' }))
    const levelSelect = screen.getByRole('combobox', { name: 'Grade level' })

    expect(levelSelect).toHaveTextContent('College & Grad')
    expect(screen.getAllByRole('option', { name: 'College & Grad' })).toHaveLength(1)
    expect(screen.queryByRole('option', { name: 'College' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Grad' })).not.toBeInTheDocument()
  })
})
