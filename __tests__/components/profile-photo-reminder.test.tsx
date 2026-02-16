import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock next-auth/react with configurable session
const mockSession = {
  data: null as Record<string, unknown> | null,
  status: 'unauthenticated' as string,
}

vi.mock('next-auth/react', () => ({
  useSession: () => mockSession,
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

import { ProfilePhotoReminder } from '@/components/profile-photo-reminder'

describe('ProfilePhotoReminder', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('should not render when user is unauthenticated', () => {
    mockSession.data = null
    mockSession.status = 'unauthenticated'

    const { container } = render(<ProfilePhotoReminder />)
    expect(container.innerHTML).toBe('')
  })

  it('should not render for non-student roles', () => {
    mockSession.data = {
      user: { role: 'SUPER_ADMIN', profileImageUrl: null, name: 'Admin' },
    }
    mockSession.status = 'authenticated'

    const { container } = render(<ProfilePhotoReminder />)
    expect(container.innerHTML).toBe('')
  })

  it('should not render when student has a profile photo', () => {
    mockSession.data = {
      user: { role: 'STUDENT', profileImageUrl: 'https://example.com/photo.jpg', name: 'Student' },
    }
    mockSession.status = 'authenticated'

    const { container } = render(<ProfilePhotoReminder />)
    expect(container.innerHTML).toBe('')
  })

  it('should render for students without a profile photo', () => {
    mockSession.data = {
      user: { role: 'STUDENT', profileImageUrl: null, name: 'Student' },
    }
    mockSession.status = 'authenticated'

    render(<ProfilePhotoReminder />)
    expect(screen.getByText(/add a profile photo/i)).toBeInTheDocument()
    expect(screen.getByText(/go to settings/i)).toBeInTheDocument()
  })

  it('should link to settings page', () => {
    mockSession.data = {
      user: { role: 'STUDENT', profileImageUrl: null, name: 'Student' },
    }
    mockSession.status = 'authenticated'

    render(<ProfilePhotoReminder />)
    const link = screen.getByText(/go to settings/i)
    expect(link.closest('a')).toHaveAttribute('href', '/settings')
  })

  it('should dismiss and persist to localStorage when X is clicked', () => {
    mockSession.data = {
      user: { role: 'STUDENT', profileImageUrl: null, name: 'Student' },
    }
    mockSession.status = 'authenticated'

    render(<ProfilePhotoReminder />)
    const dismissButton = screen.getByLabelText(/dismiss reminder/i)
    fireEvent.click(dismissButton)

    expect(localStorageMock.setItem).toHaveBeenCalledWith('profile-photo-reminder-dismissed', 'true')
  })

  it('should not render when previously dismissed', () => {
    localStorageMock.getItem.mockReturnValue('true')

    mockSession.data = {
      user: { role: 'STUDENT', profileImageUrl: null, name: 'Student' },
    }
    mockSession.status = 'authenticated'

    const { container } = render(<ProfilePhotoReminder />)
    expect(container.querySelector('p')).toBeNull()
  })

  it('should not render for MENTOR role without photo', () => {
    mockSession.data = {
      user: { role: 'MENTOR', profileImageUrl: null, name: 'Mentor' },
    }
    mockSession.status = 'authenticated'

    const { container } = render(<ProfilePhotoReminder />)
    expect(container.innerHTML).toBe('')
  })

  it('should not render for PRIEST role', () => {
    mockSession.data = {
      user: { role: 'PRIEST', profileImageUrl: null, name: 'Father' },
    }
    mockSession.status = 'authenticated'

    const { container } = render(<ProfilePhotoReminder />)
    expect(container.innerHTML).toBe('')
  })
})
