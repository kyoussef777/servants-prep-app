import { AuditEventResult, RoleTag } from '@prisma/client'
import { NextResponse } from 'next/server'
import { getAuthorizationContext } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { notifyPriestNoteCreated } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'
import { canServeClass, getSundaySchoolAccess } from '@/lib/sunday-school-access'

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

// This route is intentionally separate from the general visitation endpoint.
// Priests can query every confidential note for a child. Every other user is
// restricted at query time to notes where they are the author.
export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const authorization = await getAuthorizationContext(user.id)
    if (authorization.disabled) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const childId = new URL(request.url).searchParams.get('childId')?.trim()
    if (!childId) {
      return NextResponse.json({ error: 'Child is required' }, { status: 400 })
    }

    const isPriest = authorization.roleTags.has(RoleTag.PRIEST)
    if (isPriest) {
      const child = await prisma.sundaySchoolChild.findUnique({
        where: { id: childId },
        select: { id: true },
      })
      if (!child) {
        return NextResponse.json({ error: 'Child not found' }, { status: 404 })
      }
    }

    const notes = await prisma.sundaySchoolPriestNote.findMany({
      where: {
        childId,
        ...(isPriest ? {} : { authorId: user.id }),
      },
      select: priestNoteSelect,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ notes })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// Submitting a confidential note is a narrow, audited write available to an
// active priest or someone already allowed to record this child's visitation.
// Submission never grants access to read the confidential history.
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const authorization = await getAuthorizationContext(user.id)
    if (authorization.disabled) {
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
      select: {
        id: true,
        classId: true,
        class: { select: { academicYearId: true } },
      },
    })
    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 })
    }

    const isPriest = authorization.roleTags.has(RoleTag.PRIEST)
    const classAccess =
      !isPriest && child.classId && child.class
        ? await getSundaySchoolAccess(user, child.class.academicYearId)
        : null
    if (!isPriest && (!child.classId || !classAccess || !canServeClass(classAccess, child.classId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

    await notifyPriestNoteCreated({
      noteId: note.id,
      childId,
      submittedById: user.id,
    }).catch((error: unknown) => {
      // The note is already committed, so a notification outage must not make
      // the user retry and accidentally create a duplicate confidential note.
      console.error('Failed to alert priests about a confidential note', error)
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
