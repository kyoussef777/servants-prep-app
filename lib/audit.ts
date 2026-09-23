import { AuditEventResult, type Prisma } from '@prisma/client'
import { pruneAuditEvents } from '@/lib/audit-retention'
import { prisma } from '@/lib/prisma'

const SENSITIVE_KEY = /password|token|secret|authorization|cookie/i

export async function recordAuditEvent(input: {
  actorUserId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  result: AuditEventResult
  reason?: string
  requestId?: string
  metadata?: Prisma.InputJsonObject
}) {
  try {
    await prisma.auditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        result: input.result,
        reason: input.reason,
        requestId: input.requestId,
        metadata: input.metadata,
      },
    })
  } catch (error) {
    // Audit availability must never block the action being audited.
    console.error('Failed to write audit event', error)
    return
  }

  try {
    // New activity is another opportunity to enforce the short retention
    // window instead of waiting for the scheduled cleanup.
    await pruneAuditEvents()
  } catch (error) {
    console.error('Failed to prune expired audit events', error)
  }
}

export function sanitizeAuditMetadata(value: Prisma.JsonValue): Prisma.JsonValue {
  if (Array.isArray(value)) return value.map(sanitizeAuditMetadata)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, child]) =>
        SENSITIVE_KEY.test(key) || child === undefined
          ? []
          : [[key, sanitizeAuditMetadata(child)]]
      )
    )
  }
  return value
}
