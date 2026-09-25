import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MentorFilterCombobox } from '@/components/admin/mentor-filter-combobox'

const mentors = [
  { id: 'mentor-1', name: 'Abahoor Girgis' },
  { id: 'mentor-2', name: 'Jessica Samy' },
  { id: 'mentor-3', name: 'John Henaen' },
]

describe('MentorFilterCombobox', () => {
  it('shows the full list and narrows it as the user types', async () => {
    const user = userEvent.setup()
    render(
      <MentorFilterCombobox
        mentors={mentors}
        workload={new Map([['mentor-1', 1], ['mentor-2', 3], ['mentor-3', 2]])}
        value="all"
        onValueChange={vi.fn()}
      />
    )

    const input = screen.getByRole('combobox', { name: 'Filter by mentor' })
    await user.click(input)

    expect(screen.getByRole('option', { name: /Abahoor Girgis/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Jessica Samy/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /John Henaen/ })).toBeInTheDocument()

    await user.type(input, 'jess')

    expect(screen.getByRole('option', { name: /Jessica Samy/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Abahoor Girgis/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /John Henaen/ })).not.toBeInTheDocument()
  })

  it('keeps special filters and selects a mentor from the filtered list', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <MentorFilterCombobox
        mentors={mentors}
        workload={new Map()}
        value="all"
        onValueChange={onValueChange}
      />
    )

    const input = screen.getByRole('combobox', { name: 'Filter by mentor' })
    await user.click(input)
    expect(screen.getByRole('option', { name: 'All Mentors' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Unassigned' })).toBeInTheDocument()

    await user.type(input, 'john')
    await user.click(screen.getByRole('option', { name: /John Henaen/ }))

    expect(onValueChange).toHaveBeenCalledWith('mentor-3')
  })
})
