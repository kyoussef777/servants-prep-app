import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoleTag } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAuthorizationContext: vi.fn(),
  findChild: vi.fn(),
  findNotes: vi.fn(),
  createNote: vi.fn(),
  createAudit: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/lib/authorization', () => ({
  getAuthorizationContext: mocks.getAuthorizationContext,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    sundaySchoolChild: { findUnique: mocks.findChild },
    sundaySchoolPriestNote: { findMany: mocks.findNotes },
    $transaction: mocks.transaction,
  },
}))

import { GET, POST } from '@/app/api/sunday-school/priest-notes/route'

const priestAuthorization = {
  disabled: false,
  roleTags: new Set([RoleTag.PRIEST]),
}

describe('Sunday School priest-only notes API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'priest-1', role: 'PRIEST' })
    mocks.getAuthorizationContext.mockResolvedValue(priestAuthorization)
    mocks.findChild.mockResolvedValue({ id: 'child-1' })
    mocks.findNotes.mockResolvedValue([])
    mocks.createNote.mockResolvedValue({
      id: 'note-1',
      childId: 'child-1',
      content: 'Confidential pastoral context',
      createdAt: new Date('2026-09-20T12:00:00Z'),
      updatedAt: new Date('2026-09-20T12:00:00Z'),
      author: { id: 'priest-1', name: 'Father Mark' },
    })
    mocks.createAudit.mockResolvedValue({ id: 'audit-1' })
    mocks.transaction.mockImplementation(async callback => callback({
      sundaySchoolPriestNote: { create: mocks.createNote },
      auditEvent: { create: mocks.createAudit },
    }))
  })

  it('refuses to reveal notes to a user without an active Priest tag', async () => {
    mocks.getAuthorizationContext.mockResolvedValue({
      disabled: false,
      roleTags: new Set([RoleTag.SUPER_ADMIN]),
    })

    const response = await GET(
      new Request('http://localhost/api/sunday-school/priest-notes?childId=child-1')
    )

    expect(response.status).toBe(403)
    expect(mocks.findChild).not.toHaveBeenCalled()
    expect(mocks.findNotes).not.toHaveBeenCalled()
  })

  it('refuses a disabled priest before looking up the child', async () => {
    mocks.getAuthorizationContext.mockResolvedValue({
      disabled: true,
      roleTags: new Set([RoleTag.PRIEST]),
    })

    const response = await GET(
      new Request('http://localhost/api/sunday-school/priest-notes?childId=child-1')
    )

    expect(response.status).toBe(403)
    expect(mocks.findChild).not.toHaveBeenCalled()
  })

  it('returns confidential notes to an active priest', async () => {
    mocks.findNotes.mockResolvedValue([{ id: 'note-1', content: 'Private' }])

    const response = await GET(
      new Request('http://localhost/api/sunday-school/priest-notes?childId=child-1')
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ notes: [{ id: 'note-1', content: 'Private' }] })
    expect(mocks.findNotes).toHaveBeenCalledWith(expect.objectContaining({
      where: { childId: 'child-1' },
    }))
  })

  it('requires non-empty content and enforces the length limit', async () => {
    const emptyResponse = await POST(new Request(
      'http://localhost/api/sunday-school/priest-notes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: 'child-1', content: '   ' }),
      }
    ))
    expect(emptyResponse.status).toBe(400)

    const longResponse = await POST(new Request(
      'http://localhost/api/sunday-school/priest-notes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: 'child-1', content: 'x'.repeat(5001) }),
      }
    ))
    expect(longResponse.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('creates and audits a priest note without copying its content into audit metadata', async () => {
    const response = await POST(new Request(
      'http://localhost/api/sunday-school/priest-notes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId: 'child-1',
          content: '  Confidential pastoral context  ',
        }),
      }
    ))

    expect(response.status).toBe(201)
    expect(mocks.createNote).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        childId: 'child-1',
        authorId: 'priest-1',
        content: 'Confidential pastoral context',
      },
    }))
    expect(mocks.createAudit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'priest-1',
        action: 'sunday_school.priest_note.create',
        entityId: 'note-1',
        metadata: { childId: 'child-1' },
      }),
    })
    expect(JSON.stringify(mocks.createAudit.mock.calls)).not.toContain(
      'Confidential pastoral context'
    )
  })
})
