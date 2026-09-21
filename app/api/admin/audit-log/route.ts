import { AuditEventResult, Prisma, RoleTag } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getAuthorizationContext } from '@/lib/authorization'
import { sanitizeAuditMetadata } from '@/lib/audit'
import { getAuditRetentionPolicy } from '@/lib/audit-retention'
import { handleApiError } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

const DEFAULT_PAGE_SIZE = 30
const MAX_PAGE_SIZE = 100

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const authorization = await getAuthorizationContext(user.id)

    if (authorization.disabled || !authorization.roleTags.has(RoleTag.SUPER_ADMIN)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(Number.parseInt(searchParams.get('page') ?? '1', 10) || 1, 1)
    const pageSize = Math.min(
      Math.max(Number.parseInt(searchParams.get('pageSize') ?? `${DEFAULT_PAGE_SIZE}`, 10) || DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE
    )
    const search = searchParams.get('search')?.trim() ?? ''
    const resultParam = searchParams.get('result')
    const result = Object.values(AuditEventResult).includes(resultParam as AuditEventResult)
      ? resultParam as AuditEventResult
      : undefined

    const matchingTargetUsers = search
      ? await prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
          take: 100,
        })
      : []
    const matchingTargetUserIds = matchingTargetUsers.map(target => target.id)

    const where: Prisma.AuditEventWhereInput = {
      ...(result ? { result } : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' } },
              { entityType: { contains: search, mode: 'insensitive' } },
              { entityId: { contains: search, mode: 'insensitive' } },
              { reason: { contains: search, mode: 'insensitive' } },
              { actor: { name: { contains: search, mode: 'insensitive' } } },
              { actor: { email: { contains: search, mode: 'insensitive' } } },
              ...(matchingTargetUserIds.length > 0
                ? [{ entityType: 'User', entityId: { in: matchingTargetUserIds } }]
                : []),
            ],
          }
        : {}),
    }

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditEvent.count({ where }),
    ])

    const targetUserIds = Array.from(new Set(
      events.flatMap(event =>
        event.entityType === 'User' && event.entityId ? [event.entityId] : []
      )
    ))
    const targetUsers = targetUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: targetUserIds } },
          select: { id: true, name: true, email: true },
        })
      : []
    const targetsById = new Map(targetUsers.map(target => [target.id, target]))

    return NextResponse.json({
      events: events.map((event) => ({
        ...event,
        metadata: event.metadata === null ? null : sanitizeAuditMetadata(event.metadata),
        target:
          event.entityType === 'User' && event.entityId
            ? targetsById.get(event.entityId) ?? null
            : null,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
      retention: getAuditRetentionPolicy(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
