import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAdminGuard } from '@/hooks/useAdminGuard'

// Track calls to router.push
const mockPush = vi.fn()

// Default mock returns (will be overridden per-test)
let mockSession: { user?: { role?: string } } | null = null
let mockStatus = 'unauthenticated'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: mockSession,
    status: mockStatus,
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe('useAdminGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession = null
    mockStatus = 'unauthenticated'
  })

  it('should redirect to /login when unauthenticated', () => {
    mockStatus = 'unauthenticated'
    mockSession = null

    const roleCheck = vi.fn().mockReturnValue(true)
    renderHook(() => useAdminGuard(roleCheck))

    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('should redirect to /dashboard when authenticated but role check fails', () => {
    mockStatus = 'authenticated'
    mockSession = { user: { role: 'STUDENT' } }

    const roleCheck = vi.fn().mockReturnValue(false)
    renderHook(() => useAdminGuard(roleCheck))

    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('should NOT redirect when authenticated and role check passes', () => {
    mockStatus = 'authenticated'
    mockSession = { user: { role: 'SUPER_ADMIN' } }

    const roleCheck = vi.fn().mockReturnValue(true)
    renderHook(() => useAdminGuard(roleCheck))

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should NOT redirect when status is loading', () => {
    mockStatus = 'loading'
    mockSession = null

    const roleCheck = vi.fn().mockReturnValue(false)
    renderHook(() => useAdminGuard(roleCheck))

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should return session and status', () => {
    mockStatus = 'authenticated'
    mockSession = { user: { role: 'SUPER_ADMIN' } }

    const roleCheck = vi.fn().mockReturnValue(true)
    const { result } = renderHook(() => useAdminGuard(roleCheck))

    expect(result.current.session).toEqual(mockSession)
    expect(result.current.status).toBe('authenticated')
  })

  it('should call roleCheck with the user role', () => {
    mockStatus = 'authenticated'
    mockSession = { user: { role: 'MENTOR' } }

    const roleCheck = vi.fn().mockReturnValue(false)
    renderHook(() => useAdminGuard(roleCheck))

    expect(roleCheck).toHaveBeenCalledWith('MENTOR')
  })
})
