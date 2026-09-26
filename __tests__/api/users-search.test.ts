import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '@prisma/client'

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { GET } from '@/app/api/users/route'

const mockRequireAuth = vi.mocked(requireAuth)
const mockFindMany = vi.mocked(prisma.user.findMany)

describe('GET /api/users search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({
      id: 'admin-1',
      role: UserRole.SUPER_ADMIN,
    } as never)
    mockFindMany.mockResolvedValue([])
  })

  it('uses the same query to search names, email addresses, and phone numbers', async () => {
    const response = await GET(new Request('https://example.test/api/users?search=%20Liza%40Example.com%20'))

    expect(response.status).toBe(200)
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { name: { contains: 'Liza@Example.com', mode: 'insensitive' } },
          { email: { contains: 'Liza@Example.com', mode: 'insensitive' } },
          { phone: { contains: 'Liza@Example.com', mode: 'insensitive' } },
        ],
      },
    }))
  })
})
