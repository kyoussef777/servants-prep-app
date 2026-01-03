import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@prisma/client'

// Mock next-auth before importing auth-helpers
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}))

import { getServerSession } from 'next-auth'
import { getCurrentUser, requireAuth, requireRole, isPriest, isMentor, isStudent } from '@/lib/auth-helpers'

const mockGetServerSession = vi.mocked(getServerSession)

describe('auth-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCurrentUser', () => {
    it('returns user from session when authenticated', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        role: UserRole.STUDENT
      }
      mockGetServerSession.mockResolvedValue({ user: mockUser, expires: '' })

      const result = await getCurrentUser()
      expect(result).toEqual(mockUser)
    })

    it('returns undefined when no session', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const result = await getCurrentUser()
      expect(result).toBeUndefined()
    })

    it('returns undefined when session has no user', async () => {
      mockGetServerSession.mockResolvedValue({ expires: '' } as any)

      const result = await getCurrentUser()
      expect(result).toBeUndefined()
    })
  })

  describe('requireAuth', () => {
    it('returns user when authenticated', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        role: UserRole.PRIEST
      }
      mockGetServerSession.mockResolvedValue({ user: mockUser, expires: '' })

      const result = await requireAuth()
      expect(result).toEqual(mockUser)
    })

    it('throws Unauthorized when no session', async () => {
      mockGetServerSession.mockResolvedValue(null)

      await expect(requireAuth()).rejects.toThrow('Unauthorized')
    })

    it('throws Unauthorized when session has no user', async () => {
      mockGetServerSession.mockResolvedValue({ expires: '' } as any)

      await expect(requireAuth()).rejects.toThrow('Unauthorized')
    })
  })

  describe('requireRole', () => {
    it('returns user when role is allowed', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'priest@test.com',
        name: 'Fr. Test',
        role: UserRole.PRIEST
      }
      mockGetServerSession.mockResolvedValue({ user: mockUser, expires: '' })

      const result = await requireRole([UserRole.PRIEST, UserRole.SUPER_ADMIN])
      expect(result).toEqual(mockUser)
    })

    it('throws Forbidden when role is not allowed', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'student@test.com',
        name: 'Student',
        role: UserRole.STUDENT
      }
      mockGetServerSession.mockResolvedValue({ user: mockUser, expires: '' })

      await expect(requireRole([UserRole.PRIEST])).rejects.toThrow('Forbidden')
    })

    it('throws Unauthorized when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)

      await expect(requireRole([UserRole.PRIEST])).rejects.toThrow('Unauthorized')
    })

    it('accepts any of multiple allowed roles', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'admin@test.com',
        name: 'Admin',
        role: UserRole.SERVANT_PREP
      }
      mockGetServerSession.mockResolvedValue({ user: mockUser, expires: '' })

      const result = await requireRole([UserRole.PRIEST, UserRole.SERVANT_PREP, UserRole.SUPER_ADMIN])
      expect(result.role).toBe(UserRole.SERVANT_PREP)
    })
  })

  describe('isPriest', () => {
    it('returns true for PRIEST role', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { role: UserRole.PRIEST },
        expires: ''
      })

      const result = await isPriest()
      expect(result).toBe(true)
    })

    it('returns false for non-PRIEST roles', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { role: UserRole.STUDENT },
        expires: ''
      })

      const result = await isPriest()
      expect(result).toBe(false)
    })

    it('returns false when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const result = await isPriest()
      expect(result).toBe(false)
    })
  })

  describe('isMentor', () => {
    it('returns true for MENTOR role', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { role: UserRole.MENTOR },
        expires: ''
      })

      const result = await isMentor()
      expect(result).toBe(true)
    })

    it('returns false for non-MENTOR roles', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { role: UserRole.STUDENT },
        expires: ''
      })

      const result = await isMentor()
      expect(result).toBe(false)
    })

    it('returns false when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const result = await isMentor()
      expect(result).toBe(false)
    })
  })

  describe('isStudent', () => {
    it('returns true for STUDENT role', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { role: UserRole.STUDENT },
        expires: ''
      })

      const result = await isStudent()
      expect(result).toBe(true)
    })

    it('returns false for non-STUDENT roles', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { role: UserRole.PRIEST },
        expires: ''
      })

      const result = await isStudent()
      expect(result).toBe(false)
    })

    it('returns false when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const result = await isStudent()
      expect(result).toBe(false)
    })
  })
})
