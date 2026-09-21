'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

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
}

interface AuditResponse {
  events: AuditEventRow[]
  page: number
  total: number
  totalPages: number
}

const RESULT_STYLE: Record<AuditResult, string> = {
  SUCCESS: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  DENIED: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
}

function actionLabel(action: string) {
  return action.toLowerCase().split('_').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ')
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
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Activity</th>
                    <th className="px-4 py-3">Record</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.events.map((event) => (
                    <tr key={event.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3">{new Date(event.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{event.actor?.name ?? 'System'}</div>
                        {event.actor?.email && <div className="text-xs text-muted-foreground">{event.actor.email}</div>}
                      </td>
                      <td className="px-4 py-3 font-medium">{actionLabel(event.action)}</td>
                      <td className="px-4 py-3">
                        <div>{event.entityType}</div>
                        {event.entityId && <div className="max-w-48 truncate text-xs text-muted-foreground">{event.entityId}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${RESULT_STYLE[event.result]}`}>
                          {event.result}
                        </span>
                      </td>
                      <td className="max-w-sm px-4 py-3 text-xs text-muted-foreground">
                        {event.reason ?? (event.metadata ? JSON.stringify(event.metadata) : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">No activity matches these filters.</p>
          )}

          {data && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{data.total} recorded event{data.total === 1 ? '' : 's'}</p>
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
