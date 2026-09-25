import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findUnique: vi.fn(),
  transaction: vi.fn(),
  deleteUserWithRelations: vi.fn(),
  recordAuditEvent: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.findUnique },
    $transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: mocks.recordAuditEvent }))
vi.mock('@/lib/user-deletion', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/user-deletion')>()
  return {
    ...original,
    deleteUserWithRelations: mocks.deleteUserWithRelations,
  }
})

import { DELETE } from '@/app/api/users/[id]/route'
import { UserDeletionConflictError } from '@/lib/user-deletion'

const request = new Request('http://localhost/api/users/user-2', { method: 'DELETE' })
const params = { params: Promise.resolve({ id: 'user-2' }) }

describe('DELETE /api/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'admin-1', role: 'SUPER_ADMIN' })
    mocks.findUnique.mockResolvedValue({
      id: 'user-2',
      role: 'SERVANT',
      name: 'Test User',
      email: 'test@example.com',
    })
    mocks.transaction.mockImplementation(async callback => callback({ transaction: true }))
    mocks.deleteUserWithRelations.mockResolvedValue(undefined)
  })

  it('deletes the user transactionally and records the activity', async () => {
    const response = await DELETE(request, params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'User deleted successfully' })
    expect(mocks.deleteUserWithRelations).toHaveBeenCalledWith({ transaction: true }, 'user-2')
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'admin-1',
      action: 'user.delete',
      entityId: 'user-2',
      result: 'SUCCESS',
      metadata: {
        targetName: 'Test User',
        targetEmail: 'test@example.com',
      },
    }))
  })

  it('returns a clear conflict when protected history must be preserved', async () => {
    mocks.deleteUserWithRelations.mockRejectedValue(
      new UserDeletionConflictError(
        'This user cannot be deleted because they have confidential priest notes. Disable the account instead to preserve this history.',
      ),
    )

    const response = await DELETE(request, params)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'This user cannot be deleted because they have confidential priest notes. Disable the account instead to preserve this history.',
    })
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled()
  })

  it('prevents deleting the active account', async () => {
    mocks.requireAuth.mockResolvedValue({ id: 'user-2', role: 'SUPER_ADMIN' })

    const response = await DELETE(request, params)

    expect(response.status).toBe(400)
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
