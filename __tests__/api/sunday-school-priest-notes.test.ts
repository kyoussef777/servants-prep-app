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
  getSundaySchoolAccess: vi.fn(),
  canServeClass: vi.fn(),
  notifyPriestNoteCreated: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/lib/authorization', () => ({
  getAuthorizationContext: mocks.getAuthorizationContext,
}))
vi.mock('@/lib/sunday-school-access', () => ({
  getSundaySchoolAccess: mocks.getSundaySchoolAccess,
  canServeClass: mocks.canServeClass,
}))
vi.mock('@/lib/notifications', () => ({
  notifyPriestNoteCreated: mocks.notifyPriestNoteCreated,
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
    mocks.findChild.mockResolvedValue({
      id: 'child-1',
      classId: 'class-1',
      class: { academicYearId: 'year-1' },
    })
    mocks.findNotes.mockResolvedValue([])
    mocks.getSundaySchoolAccess.mockResolvedValue({ servantClassIds: new Set(['class-1']) })
    mocks.canServeClass.mockReturnValue(true)
    mocks.notifyPriestNoteCreated.mockResolvedValue(undefined)
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
    expect(mocks.notifyPriestNoteCreated).toHaveBeenCalledWith({
      noteId: 'note-1',
      childId: 'child-1',
      submittedById: 'priest-1',
    })
  })

  it('lets an assigned visitation servant submit a note without granting read access', async () => {
    mocks.requireAuth.mockResolvedValue({ id: 'servant-1', role: 'SERVANT' })
    mocks.getAuthorizationContext.mockResolvedValue({
      disabled: false,
      roleTags: new Set([RoleTag.SUNDAY_SCHOOL_SERVANT]),
    })

    const getResponse = await GET(
      new Request('http://localhost/api/sunday-school/priest-notes?childId=child-1')
    )
    expect(getResponse.status).toBe(403)

    const postResponse = await POST(new Request(
      'http://localhost/api/sunday-school/priest-notes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId: 'child-1',
          content: 'Please ask the priest to follow up privately.',
        }),
      }
    ))

    expect(postResponse.status).toBe(201)
    expect(mocks.getSundaySchoolAccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'servant-1' }),
      'year-1'
    )
    expect(mocks.canServeClass).toHaveBeenCalledWith(
      expect.anything(),
      'class-1'
    )
    expect(mocks.notifyPriestNoteCreated).toHaveBeenCalledWith({
      noteId: 'note-1',
      childId: 'child-1',
      submittedById: 'servant-1',
    })
  })

  it('refuses confidential submissions outside the user\'s visitation scope', async () => {
    mocks.requireAuth.mockResolvedValue({ id: 'servant-2', role: 'SERVANT' })
    mocks.getAuthorizationContext.mockResolvedValue({
      disabled: false,
      roleTags: new Set([RoleTag.SUNDAY_SCHOOL_SERVANT]),
    })
    mocks.canServeClass.mockReturnValue(false)

    const response = await POST(new Request(
      'http://localhost/api/sunday-school/priest-notes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: 'child-1', content: 'Private follow-up' }),
      }
    ))

    expect(response.status).toBe(403)
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.notifyPriestNoteCreated).not.toHaveBeenCalled()
  })
})
