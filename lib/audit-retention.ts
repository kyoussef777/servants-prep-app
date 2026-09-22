import { prisma } from '@/lib/prisma'

const DEFAULT_RETENTION_DAYS = 30
const MAX_RETENTION_DAYS = 30
const DEFAULT_MAX_EVENTS = 50_000

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, minimum), maximum)
}

export function getAuditRetentionPolicy() {
  return {
    // Activity data is intentionally short-lived. Cap an older deployment
    // setting as well as the default so records can never remain over a month.
    days: boundedInteger(
      process.env.AUDIT_RETENTION_DAYS,
      DEFAULT_RETENTION_DAYS,
      1,
      MAX_RETENTION_DAYS
    ),
    maxEvents: boundedInteger(process.env.AUDIT_MAX_EVENTS, DEFAULT_MAX_EVENTS, 1000, 1_000_000),
  }
}

export async function pruneAuditEvents(options?: {
  now?: Date
  days?: number
  maxEvents?: number
}) {
  const policy = getAuditRetentionPolicy()
  const now = options?.now ?? new Date()
  const days = options?.days ?? policy.days
  const maxEvents = options?.maxEvents ?? policy.maxEvents
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  const expired = await prisma.auditEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })

  // Find the first event outside the newest maxEvents rows. Everything older
  // than (or tied behind) this deterministic boundary can be removed.
  const overflowBoundary = await prisma.auditEvent.findFirst({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: maxEvents,
    select: { id: true, createdAt: true },
  })

  let overflowCount = 0
  if (overflowBoundary) {
    const overflow = await prisma.auditEvent.deleteMany({
      where: {
        OR: [
          { createdAt: { lt: overflowBoundary.createdAt } },
          {
            createdAt: overflowBoundary.createdAt,
            id: { lte: overflowBoundary.id },
          },
        ],
      },
    })
    overflowCount = overflow.count
  }

  return {
    cutoff: cutoff.toISOString(),
    expiredCount: expired.count,
    overflowCount,
    deletedCount: expired.count + overflowCount,
    days,
    maxEvents,
  }
}
