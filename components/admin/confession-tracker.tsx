'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FilterSelect } from '@/components/ui/filter-select'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { formatToastTimestamp } from '@/lib/utils'
import { fetcher, defaultSWRConfig, staticDataConfig } from '@/lib/swr'
import type { AcademicYear } from '@/lib/types'
import {
  formatConfessionPeriod,
  getConfessionPeriods,
  getConfessionPeriodStatus,
  getStudentStart,
  type ConfessionPeriod,
  type ConfessionPeriodStatus,
} from '@/lib/confession'
import { uploadSlip, deleteSlip, useSlips } from '@/lib/slips-client'

export interface ConfessionEnrollment {
  studentId: string
  academicYearId: string | null
  attendanceStartDate: string | null
  enrolledAt: string
  student: { id: string; name: string }
  fatherOfConfession?: { name: string } | null
}

interface ConfessionSlip {
  id: string
  studentId: string
  periodStart: string
  imageUrl: string
  createdAt: string
  uploader: { name: string } | null
}

const STATUS_BADGE: Record<ConfessionPeriodStatus, { label: string; className: string }> = {
  slip: { label: 'Signed', className: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300' },
  registration: { label: 'Registration', className: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300' },
  missing: { label: 'Missing', className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300' },
  due: { label: 'Due', className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300' },
  upcoming: { label: 'Upcoming', className: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400' },
  na: { label: 'N/A', className: 'bg-transparent text-gray-400 border-gray-200 dark:border-gray-700' },
}

/**
 * Grid of students × 2-month confession periods for an academic year.
 * Pass `enrollment` to show just that student (student details modal);
 * otherwise all active students are loaded.
 */
export function ConfessionTracker({ enrollment, canEdit }: { enrollment?: ConfessionEnrollment; canEdit: boolean }) {
  const { data: years = [] } = useSWR<AcademicYear[]>('/api/academic-years', fetcher, staticDataConfig)
  const { data: fetched, error } = useSWR<ConfessionEnrollment[]>(
    enrollment ? null : '/api/enrollments?status=ACTIVE',
    fetcher,
    defaultSWRConfig
  )
  const { data: slips = [], mutate: mutateSlips } = useSlips<ConfessionSlip>('CONFESSION', enrollment?.studentId)
  const enrollments = useMemo(() => (enrollment ? [enrollment] : fetched), [enrollment, fetched])

  const [pickedYearId, setYearId] = useState('')
  const [busyCell, setBusyCell] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false)

  // Years come newest first; default to the active one
  const yearId = pickedYearId || (years.find(y => y.isActive) ?? years[0])?.id || ''

  const rows = useMemo(() => {
    const year = years.find(y => y.id === yearId)
    const periods = year ? getConfessionPeriods(year) : []
    const slipByKey = new Map(slips.map(s => [`${s.studentId}|${new Date(s.periodStart).toISOString()}`, s]))
    return [...(enrollments ?? [])].sort((a, b) => a.student.name.localeCompare(b.student.name)).map(e => {
      const start = getStudentStart({ ...e, academicYear: years.find(y => y.id === e.academicYearId) })
      const cells = periods.map(period => {
        const key = `${e.studentId}|${period.start.toISOString()}`
        const slip = slipByKey.get(key)
        return { key, period, slip, status: getConfessionPeriodStatus(period, start, !!slip) }
      })
      return { enrollment: e, cells, missing: cells.filter(c => c.status === 'missing').length }
    })
  }, [enrollments, slips, years, yearId])

  const visibleRows = rows.filter(r =>
    (!onlyMissing || r.missing > 0) &&
    (!search || r.enrollment.student.name.toLowerCase().includes(search.toLowerCase()))
  )

  const handleUpload = async (key: string, studentId: string, period: ConfessionPeriod, file: File | undefined) => {
    if (!file) return
    setBusyCell(key)
    try {
      await uploadSlip(file, { studentId, type: 'CONFESSION', periodStart: period.start.toISOString() })
      toast.success('Confession slip uploaded', { description: formatConfessionPeriod(period) })
      await mutateSlips()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setBusyCell(null)
    }
  }

  const handleRemove = async (slip: ConfessionSlip) => {
    if (!confirm('Remove this confession slip?')) return
    try {
      await deleteSlip(slip.id)
      toast.success('Confession slip removed')
      await mutateSlips()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove slip')
    }
  }

  if (error) return <EmptyState message="Failed to load the confession tracker" />
  if (!enrollments) return <TableSkeleton />

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          aria-label="Academic year"
          value={yearId}
          onChange={setYearId}
          options={years.map(y => ({ value: y.id, label: y.name }))}
          className="h-9 py-1"
        />
        {!enrollment && (
          <>
            <Input
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full sm:w-56 text-sm"
            />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="h-4 w-4 rounded" />
              Only missing ({rows.filter(r => r.missing > 0).length})
            </label>
          </>
        )}
      </div>
      <p className="text-xs text-gray-500">
        Students must confess at least once every 2 months. The registration form (on the student&apos;s Profile tab) covers
        their first period; after that, upload a photo of the slip signed by their father of confession.
      </p>

      <Card className="py-0 gap-0 overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          {visibleRows.length === 0 ? (
            <EmptyState message="No students to show" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 dark:bg-gray-900">
                <tr>
                  {!enrollment && <th className="text-left p-3 font-semibold sticky left-0 bg-gray-50 dark:bg-gray-900">Student</th>}
                  {visibleRows[0].cells.map(({ period }) => (
                    <th key={period.start.toISOString()} className="p-3 font-semibold text-center whitespace-nowrap">
                      {formatConfessionPeriod(period)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ enrollment: e, cells, missing }) => (
                  <tr key={e.studentId} className="border-b last:border-0">
                    {!enrollment && (
                      <td className="p-3 sticky left-0 bg-card min-w-44">
                        <div className="font-medium">{e.student.name}</div>
                        <div className="text-xs text-gray-500">{e.fatherOfConfession?.name ?? 'No father of confession'}</div>
                        {missing > 0 && <div className="text-xs text-red-600">{missing} missing</div>}
                      </td>
                    )}
                    {cells.map(({ key, period, slip, status }) => {
                      const badge = (
                        <Badge variant="outline" className={`${STATUS_BADGE[status].className} ${slip ? 'hover:underline' : ''}`}>
                          {STATUS_BADGE[status].label}
                        </Badge>
                      )
                      return (
                        <td key={key} className="p-2 text-center align-top">
                          <div className="flex flex-col items-center gap-1">
                            {slip ? (
                              <a
                                href={slip.imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Uploaded ${formatToastTimestamp(new Date(slip.createdAt))}${slip.uploader ? ` by ${slip.uploader.name}` : ''}`}
                              >
                                {badge}
                              </a>
                            ) : badge}
                            {canEdit && status !== 'na' && status !== 'upcoming' && (
                              <div className="flex items-center gap-1">
                                <label className="cursor-pointer text-xs text-maroon-700 dark:text-maroon-300 hover:underline rounded px-1 focus-within:ring-2 focus-within:ring-maroon-500">
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="sr-only"
                                    disabled={busyCell === key}
                                    onChange={(ev) => {
                                      const file = ev.target.files?.[0]
                                      ev.target.value = ''
                                      handleUpload(key, e.studentId, period, file)
                                    }}
                                  />
                                  {busyCell === key ? 'Uploading…' : slip ? 'Replace' : 'Upload'}
                                </label>
                                {slip && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemove(slip)}
                                    aria-label={`Remove ${formatConfessionPeriod(period)} slip`}
                                    className="p-0.5 text-gray-400 hover:text-red-600"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
