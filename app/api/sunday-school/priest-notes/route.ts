import { RoleTag } from '@prisma/client'
import { NextResponse } from 'next/server'
import { getAuthorizationContext } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

const priestNoteSelect = {
  id: true,
  visitationId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  visitation: {
    select: {
      id: true,
      status: true,
      visitedAt: true,
      createdAt: true,
    },
  },
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
        visitation: { childId },
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
