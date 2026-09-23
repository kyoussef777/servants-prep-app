'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  auditActionSummary,
  auditEntityLabel,
  auditMetadataEntries,
  auditReasonLabel,
  auditTargetLabel,
} from '@/lib/audit-display'

type AuditResult = 'SUCCESS' | 'DENIED' | 'FAILED'

interface AuditEventRow {
  id: string
  action: string
  entityType: string
  entityId: string | null
  result: AuditResult
  reason: string | null
  metadata: unknown
  createdAt: string
  actor: { id: string; name: string | null; email: string } | null
  target: { id: string; name: string | null; email: string } | null
}

interface AuditResponse {
  events: AuditEventRow[]
  page: number
  total: number
  totalPages: number
  retention: { hours: number; maxEvents: number }
}

const RESULT_STYLE: Record<AuditResult, string> = {
  SUCCESS: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  DENIED: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
}

export default function ActivityPage() {
  const [data, setData] = useState<AuditResponse | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [result, setResult] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      if (result) params.set('result', result)
      const response = await fetch(`/api/admin/audit-log?${params}`)
      if (!response.ok) throw new Error('Unable to load activity')
      setData(await response.json())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load activity')
    } finally {
      setLoading(false)
    }
  }, [page, result, search])

  useEffect(() => { void loadEvents() }, [loadEvents])

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Activity log</CardTitle>
          <CardDescription>Security and administrative activity recorded across the website.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault()
              setPage(1)
              setSearch(searchInput.trim())
            }}
          >
            <Input
              aria-label="Search activity"
              placeholder="Search user, action, or record"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <select
              aria-label="Filter by result"
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={result}
              onChange={(event) => { setPage(1); setResult(event.target.value) }}
            >
              <option value="">All results</option>
              <option value="SUCCESS">Successful</option>
              <option value="DENIED">Denied</option>
              <option value="FAILED">Failed</option>
            </select>
            <Button type="submit">Search</Button>
            <Button type="button" variant="outline" onClick={() => void loadEvents()}>Refresh</Button>
          </form>

          {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">Loading activity…</p>
          ) : data?.events.length ? (
            <div className="space-y-3">
              {data.events.map(event => {
                const reason = auditReasonLabel(event.reason)
                const metadata = auditMetadataEntries(event.metadata)
                const hasTechnicalDetails = Boolean(event.entityId) || metadata.length > 0

                return (
                  <article key={event.id} className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-foreground">{auditActionSummary(event)}</h2>
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${RESULT_STYLE[event.result]}`}>
                            {event.result === 'SUCCESS' ? 'Successful' : event.result === 'DENIED' ? 'Denied' : 'Failed'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">{event.actor?.name ?? 'System'}</span>
                          {event.actor?.email ? ` · ${event.actor.email}` : ''}
                        </p>
                      </div>
                      <time className="shrink-0 text-sm text-muted-foreground" dateTime={event.createdAt}>
                        {new Date(event.createdAt).toLocaleString()}
                      </time>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div className="rounded-md bg-muted/50 px-3 py-2">
                        <span className="text-muted-foreground">Affected record: </span>
                        <span className="font-medium">{auditTargetLabel(event)}</span>
                        <span className="text-muted-foreground"> · {auditEntityLabel(event.entityType)}</span>
                      </div>
                      {reason && (
                        <div className="rounded-md bg-muted/50 px-3 py-2">
                          <span className="text-muted-foreground">Explanation: </span>
                          <span>{reason}</span>
                        </div>
                      )}
                    </div>

                    {hasTechnicalDetails && (
                      <details className="mt-3 text-sm">
                        <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                          Additional details
                        </summary>
                        <dl className="mt-2 grid gap-x-6 gap-y-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-2">
                          {event.entityId && (
                            <div className="min-w-0">
                              <dt className="text-xs font-medium text-muted-foreground">Record ID</dt>
                              <dd className="break-all text-xs">{event.entityId}</dd>
                            </div>
                          )}
                          {metadata.map(entry => (
                            <div key={entry.label} className="min-w-0">
                              <dt className="text-xs font-medium text-muted-foreground">{entry.label}</dt>
                              <dd className="break-words text-xs">{entry.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    )}
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">No activity matches these filters.</p>
          )}

          {data && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{data.total} recorded event{data.total === 1 ? '' : 's'}</p>
                <p className="text-xs text-muted-foreground">
                  Activity is kept for up to {data.retention.hours} hours, with a maximum of {data.retention.maxEvents.toLocaleString()} events.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
                <span className="text-sm">Page {data.page} of {data.totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
