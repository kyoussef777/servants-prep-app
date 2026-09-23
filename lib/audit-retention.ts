import { prisma } from '@/lib/prisma'

const RETENTION_HOURS = 2
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
    // Activity is deliberately ephemeral. This is not configurable so an old
    // deployment setting cannot retain records beyond the two-hour limit.
    hours: RETENTION_HOURS,
    maxEvents: boundedInteger(process.env.AUDIT_MAX_EVENTS, DEFAULT_MAX_EVENTS, 1000, 1_000_000),
  }
}

export function getAuditRetentionCutoff(now = new Date()): Date {
  return new Date(now.getTime() - RETENTION_HOURS * 60 * 60 * 1000)
}

export async function pruneAuditEvents(options?: {
  now?: Date
  hours?: number
  maxEvents?: number
}) {
  const policy = getAuditRetentionPolicy()
  const now = options?.now ?? new Date()
  const hours = options?.hours ?? policy.hours
  const maxEvents = options?.maxEvents ?? policy.maxEvents
  const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000)

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
    hours,
    maxEvents,
  }
}
