import { AuditEventResult, RoleTag } from '@prisma/client'
import { NextResponse } from 'next/server'
import { getAuthorizationContext } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

const MAX_NOTE_LENGTH = 5_000

const priestNoteSelect = {
  id: true,
  childId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: { id: true, name: true },
  },
} as const

async function hasActivePriestTag(userId: string) {
  const authorization = await getAuthorizationContext(userId)
  return !authorization.disabled && authorization.roleTags.has(RoleTag.PRIEST)
}

// This route is intentionally separate from the general visitation endpoint.
// Non-priests cannot query, infer, create, or update confidential note content.
export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    if (!(await hasActivePriestTag(user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const childId = new URL(request.url).searchParams.get('childId')?.trim()
    if (!childId) {
      return NextResponse.json({ error: 'Child is required' }, { status: 400 })
    }

    const child = await prisma.sundaySchoolChild.findUnique({
      where: { id: childId },
      select: { id: true },
    })
    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 })
    }

    const notes = await prisma.sundaySchoolPriestNote.findMany({
      where: { childId },
      select: priestNoteSelect,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ notes })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// Adding a confidential note is a narrow, audited exception to the normal
// PRIEST read-only policy. It does not grant permission to alter ministry data.
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    if (!(await hasActivePriestTag(user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const values = body as Record<string, unknown>
    const childId = typeof values.childId === 'string' ? values.childId.trim() : ''
    const content = typeof values.content === 'string' ? values.content.trim() : ''

    if (!childId) {
      return NextResponse.json({ error: 'Child is required' }, { status: 400 })
    }
    if (!content) {
      return NextResponse.json({ error: 'A confidential note is required' }, { status: 400 })
    }
    if (content.length > MAX_NOTE_LENGTH) {
      return NextResponse.json(
        { error: `Confidential notes must be ${MAX_NOTE_LENGTH.toLocaleString()} characters or fewer` },
        { status: 400 }
      )
    }

    const child = await prisma.sundaySchoolChild.findUnique({
      where: { id: childId },
      select: { id: true },
    })
    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 })
    }

    const note = await prisma.$transaction(async tx => {
      const created = await tx.sundaySchoolPriestNote.create({
        data: {
          childId,
          authorId: user.id,
          content,
        },
        select: priestNoteSelect,
      })

      await tx.auditEvent.create({
        data: {
          actorUserId: user.id,
          action: 'sunday_school.priest_note.create',
          entityType: 'SundaySchoolPriestNote',
          entityId: created.id,
          result: AuditEventResult.SUCCESS,
          metadata: { childId },
        },
      })

      return created
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
