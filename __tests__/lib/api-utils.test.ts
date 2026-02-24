import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import {
  handleApiError,
  parseTimeString,
  withErrorHandler,
  withAuth,
  withRole,
  withAdminAuth,
  getMentorStudentIds,
} from '@/lib/api-utils'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    studentEnrollment: {
      findMany: vi.fn(),
    },
  },
}))

// Mock auth-helpers
vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}))

describe('handleApiError', () => {
  it('should return 401 for "Unauthorized" error', async () => {
    const response = handleApiError(new Error('Unauthorized'))
    const body = await response.json()
    expect(response.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })

  it('should return 403 for "Forbidden" error', async () => {
    const response = handleApiError(new Error('Forbidden'))
    const body = await response.json()
    expect(response.status).toBe(403)
    expect(body.error).toBe('Forbidden')
  })

  it('should return 404 for "Not found" error', async () => {
    const response = handleApiError(new Error('Not found'))
    const body = await response.json()
    expect(response.status).toBe(404)
    expect(body.error).toBe('Not found')
  })

  it('should return 500 with message for generic Error', async () => {
    const response = handleApiError(new Error('Something broke'))
    const body = await response.json()
    expect(response.status).toBe(500)
    expect(body.error).toBe('Something broke')
  })

  it('should return 500 with generic message for non-Error values', async () => {
    const response = handleApiError('string error')
    const body = await response.json()
    expect(response.status).toBe(500)
    expect(body.error).toBe('Internal server error')
  })

  it('should return 500 for null', async () => {
    const response = handleApiError(null)
    const body = await response.json()
    expect(response.status).toBe(500)
    expect(body.error).toBe('Internal server error')
  })

  it('should return 500 for undefined', async () => {
    const response = handleApiError(undefined)
    const body = await response.json()
    expect(response.status).toBe(500)
    expect(body.error).toBe('Internal server error')
  })
})

describe('parseTimeString', () => {
  it('should parse HH:MM format', () => {
    const result = parseTimeString('14:30')
    expect(result).toBeInstanceOf(Date)
    expect(result!.getHours()).toBe(14)
    expect(result!.getMinutes()).toBe(30)
  })

  it('should parse HH:MM:SS format', () => {
    const result = parseTimeString('14:30:45')
    expect(result).toBeInstanceOf(Date)
    expect(result!.getSeconds()).toBe(45)
  })

  it('should parse midnight (00:00)', () => {
    const result = parseTimeString('00:00')
    expect(result).toBeInstanceOf(Date)
    expect(result!.getHours()).toBe(0)
    expect(result!.getMinutes()).toBe(0)
  })

  it('should parse end of day (23:59)', () => {
    const result = parseTimeString('23:59')
    expect(result).toBeInstanceOf(Date)
    expect(result!.getHours()).toBe(23)
    expect(result!.getMinutes()).toBe(59)
  })

  it('should return null for null input', () => {
    expect(parseTimeString(null)).toBeNull()
  })

  it('should return null for undefined input', () => {
    expect(parseTimeString(undefined)).toBeNull()
  })

  it('should return null for empty string', () => {
    expect(parseTimeString('')).toBeNull()
  })

  it('should return null for whitespace-only string', () => {
    expect(parseTimeString('   ')).toBeNull()
  })

  it('should return null for invalid time string', () => {
    expect(parseTimeString('not-a-time')).toBeNull()
  })

  it('should trim whitespace before parsing', () => {
    const result = parseTimeString('  14:30  ')
    expect(result).toBeInstanceOf(Date)
    expect(result!.getHours()).toBe(14)
  })
})

describe('getMentorStudentIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return undefined for non-MENTOR role', async () => {
    const result = await getMentorStudentIds('user1', UserRole.SUPER_ADMIN)
    expect(result).toBeUndefined()
  })

  it('should return undefined for STUDENT role', async () => {
    const result = await getMentorStudentIds('user1', UserRole.STUDENT)
    expect(result).toBeUndefined()
  })

  it('should query prisma and return student IDs for MENTOR', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.studentEnrollment.findMany).mockResolvedValue([
      { studentId: 'student1' },
      { studentId: 'student2' },
    ] as never)

    const result = await getMentorStudentIds('mentor1', UserRole.MENTOR)
    expect(result).toEqual(['student1', 'student2'])
    expect(prisma.studentEnrollment.findMany).toHaveBeenCalledWith({
      where: { mentorId: 'mentor1' },
      select: { studentId: true },
    })
  })

  it('should return empty array when mentor has no students', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.studentEnrollment.findMany).mockResolvedValue([])

    const result = await getMentorStudentIds('mentor1', UserRole.MENTOR)
    expect(result).toEqual([])
  })
})

describe('withErrorHandler', () => {
  it('should pass through successful responses', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = withErrorHandler(handler)
    const response = await wrapped()
    const body = await response.json()
    expect(body.ok).toBe(true)
  })

  it('should catch errors and return error response', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Something went wrong'))
    const wrapped = withErrorHandler(handler)
    const response = await wrapped()
    const body = await response.json()
    expect(response.status).toBe(500)
    expect(body.error).toBe('Something went wrong')
  })

  it('should handle Unauthorized errors with 401', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Unauthorized'))
    const wrapped = withErrorHandler(handler)
    const response = await wrapped()
    expect(response.status).toBe(401)
  })
})

describe('withAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should inject user and call handler when authenticated', async () => {
    const { requireAuth } = await import('@/lib/auth-helpers')
    const mockUser = { id: 'user1', role: UserRole.SUPER_ADMIN }
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never)

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = withAuth(handler)
    const response = await wrapped()
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(handler).toHaveBeenCalledWith(mockUser)
  })

  it('should return 401 when not authenticated', async () => {
    const { requireAuth } = await import('@/lib/auth-helpers')
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

    const handler = vi.fn()
    const wrapped = withAuth(handler)
    const response = await wrapped()
    expect(response.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('withRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call handler when user has allowed role', async () => {
    const { requireAuth } = await import('@/lib/auth-helpers')
    const mockUser = { id: 'user1', role: UserRole.SUPER_ADMIN }
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never)

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = withRole([UserRole.SUPER_ADMIN], handler)
    const response = await wrapped()
    const body = await response.json()
    expect(body.ok).toBe(true)
  })

  it('should return 403 when user has wrong role', async () => {
    const { requireAuth } = await import('@/lib/auth-helpers')
    const mockUser = { id: 'user1', role: UserRole.STUDENT }
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never)

    const handler = vi.fn()
    const wrapped = withRole([UserRole.SUPER_ADMIN], handler)
    const response = await wrapped()
    expect(response.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('should return 401 when not authenticated', async () => {
    const { requireAuth } = await import('@/lib/auth-helpers')
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

    const handler = vi.fn()
    const wrapped = withRole([UserRole.SUPER_ADMIN], handler)
    const response = await wrapped()
    expect(response.status).toBe(401)
  })
})

describe('withAdminAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow SUPER_ADMIN', async () => {
    const { requireAuth } = await import('@/lib/auth-helpers')
    vi.mocked(requireAuth).mockResolvedValue({ id: 'u1', role: UserRole.SUPER_ADMIN } as never)

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = withAdminAuth(handler)
    const response = await wrapped()
    expect(response.status).toBe(200)
  })

  it('should allow PRIEST', async () => {
    const { requireAuth } = await import('@/lib/auth-helpers')
    vi.mocked(requireAuth).mockResolvedValue({ id: 'u1', role: UserRole.PRIEST } as never)

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = withAdminAuth(handler)
    const response = await wrapped()
    expect(response.status).toBe(200)
  })

  it('should allow SERVANT_PREP', async () => {
    const { requireAuth } = await import('@/lib/auth-helpers')
    vi.mocked(requireAuth).mockResolvedValue({ id: 'u1', role: UserRole.SERVANT_PREP } as never)

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = withAdminAuth(handler)
    const response = await wrapped()
    expect(response.status).toBe(200)
  })

  it('should reject MENTOR', async () => {
    const { requireAuth } = await import('@/lib/auth-helpers')
    vi.mocked(requireAuth).mockResolvedValue({ id: 'u1', role: UserRole.MENTOR } as never)

    const handler = vi.fn()
    const wrapped = withAdminAuth(handler)
    const response = await wrapped()
    expect(response.status).toBe(403)
  })

  it('should reject STUDENT', async () => {
    const { requireAuth } = await import('@/lib/auth-helpers')
    vi.mocked(requireAuth).mockResolvedValue({ id: 'u1', role: UserRole.STUDENT } as never)

    const handler = vi.fn()
    const wrapped = withAdminAuth(handler)
    const response = await wrapped()
    expect(response.status).toBe(403)
  })
})
