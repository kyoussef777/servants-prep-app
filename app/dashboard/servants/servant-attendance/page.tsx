'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SundaySchoolServantAttendanceStatus } from '@prisma/client'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/admin/page-header'
import { SundaySchoolRecentAttendanceChart } from '@/components/sunday-school-recent-attendance-chart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageLoading } from '@/components/ui/page-loading'
import { useSundaySchoolGuard } from '@/hooks/useSundaySchoolGuard'
import {
  useSundaySchoolClasses,
  useSundaySchoolDashboard,
  useSundaySchoolServantAttendance,
} from '@/lib/swr'
import {
  getLevelDisplayName,
  getMostRecentSunday,
  getTodayDateInputValue,
  toDateInputValue,
} from '@/lib/sunday-school-class'
import type {
  SundaySchoolClass,
  SundaySchoolDashboard,
  SundaySchoolServantAttendanceResponse,
} from '@/types/sunday-school'

function ServantAttendanceContent() {
  const { session, status } = useSundaySchoolGuard()
  const router = useRouter()
  const searchParams = useSearchParams()
  const canOpenPage = session?.user?.sundaySchool?.isCoordinator ?? false

  const { data: classesData, isLoading: classesLoading } = useSundaySchoolClasses()
  const classes = useMemo(
    () => ((classesData as SundaySchoolClass[] | undefined) ?? []).filter(
      cls => cls.isActive && cls.canTakeServantAttendance
    ),
    [classesData]
  )

  const [selectedClassId, setSelectedClassId] = useState('')
  const [sessionDate, setSessionDate] = useState(toDateInputValue(getMostRecentSunday()))
  const [marks, setMarks] = useState<Record<string, SundaySchoolServantAttendanceStatus>>({})
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  useEffect(() => {
    if (status === 'authenticated' && !canOpenPage) {
      router.replace('/dashboard/servants')
    }
  }, [canOpenPage, router, status])

  useEffect(() => {
    if (selectedClassId || classes.length === 0) return
    const fromQuery = searchParams.get('classId')
    const match = fromQuery && classes.some(cls => cls.id === fromQuery)
      ? fromQuery
      : (classes.find(cls => cls.assignments.some(assignment => assignment.classId === cls.id))
          ?? classes[0]).id
    setSelectedClassId(match)
  }, [classes, searchParams, selectedClassId])

  const {
    data: attendanceData,
    isLoading: attendanceLoading,
    mutate: refreshAttendance,
  } = useSundaySchoolServantAttendance(
    canOpenPage ? selectedClassId : undefined,
    canOpenPage ? sessionDate : undefined
  )
  const attendance = attendanceData as SundaySchoolServantAttendanceResponse | undefined
  const selectedClass = classes.find(cls => cls.id === selectedClassId)

  const {
    data: trendData,
    isLoading: trendLoading,
    isValidating: trendRefreshing,
    mutate: refreshTrend,
  } = useSundaySchoolDashboard(
    selectedClass?.academicYearId,
    selectedClassId || undefined,
    'servants'
  )
  const trendDashboard = trendData as SundaySchoolDashboard | undefined

  useEffect(() => {
    if (!attendance) return
    setMarks(Object.fromEntries(attendance.roster.map(entry => [
      entry.userId,
      entry.attendance?.status ?? SundaySchoolServantAttendanceStatus.PRESENT,
    ])))
  }, [attendance])

  const markAll = (statusValue: SundaySchoolServantAttendanceStatus) => {
    if (!attendance) return
    setMarks(Object.fromEntries(attendance.roster.map(entry => [entry.userId, statusValue])))
  }

  const presentCount = useMemo(
    () => Object.values(marks).filter(
      mark => mark === SundaySchoolServantAttendanceStatus.PRESENT
    ).length,
    [marks]
  )

  const handleSave = async () => {
    if (!attendance || !selectedClassId) return

    setSaving(true)
    try {
      const response = await fetch('/api/sunday-school/servant-attendance/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: selectedClassId,
          date: sessionDate,
          records: attendance.roster.map(entry => ({
            servantId: entry.userId,
            status: marks[entry.userId] ?? SundaySchoolServantAttendanceStatus.PRESENT,
          })),
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Failed to save servant attendance')

      await Promise.all([refreshAttendance(), refreshTrend()])
      const saved = new Date()
      setLastSaved(saved)
      toast.success('Servant attendance saved', { description: saved.toLocaleString() })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save servant attendance')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || classesLoading || (status === 'authenticated' && !canOpenPage)) {
    return <PageLoading />
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-950 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Servant Attendance"
          description="Record which servants attended each class week."
          lastSaved={lastSaved}
          actions={attendance ? (
            <Button onClick={handleSave} disabled={saving || attendance.roster.length === 0}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
          ) : undefined}
        />

        {classes.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState message="You do not coordinate any active Sunday School classes." />
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="servant-attendance-class">Class</Label>
                  <select
                    id="servant-attendance-class"
                    value={selectedClassId}
                    onChange={event => setSelectedClassId(event.target.value)}
                    className="h-9 w-full rounded-md border bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
                  >
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} — {getLevelDisplayName(cls.level)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="servant-attendance-date">Week of</Label>
                  <Input
                    id="servant-attendance-date"
                    type="date"
                    value={sessionDate}
                    max={getTodayDateInputValue()}
                    onChange={event => setSessionDate(event.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {selectedClass && (
              <SundaySchoolRecentAttendanceChart
                trend={trendDashboard?.attendanceTrend}
                className={`${selectedClass.name} servants`}
                throughDate={sessionDate}
                isLoading={trendLoading || trendRefreshing}
              />
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>
                  {selectedClass?.name ?? 'Servants'}
                  {attendance && (
                    <span className="ml-2 text-sm font-normal text-gray-600 dark:text-gray-400">
                      {presentCount} of {attendance.roster.length} present
                    </span>
                  )}
                </CardTitle>
                {attendance && attendance.roster.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAll(SundaySchoolServantAttendanceStatus.PRESENT)}
                    >
                      All present
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAll(SundaySchoolServantAttendanceStatus.ABSENT)}
                    >
                      All absent
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {attendanceLoading ? (
                  <p className="py-8 text-center text-gray-500">Loading servant roster…</p>
                ) : !attendance || attendance.roster.length === 0 ? (
                  <EmptyState message="No active servants are assigned directly to this class." />
                ) : (
                  <div className="divide-y dark:divide-gray-800">
                    {attendance.roster.map(entry => {
                      const current = marks[entry.userId] ?? SundaySchoolServantAttendanceStatus.PRESENT
                      return (
                        <div key={entry.userId} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{entry.name}</p>
                            <p className="truncate text-sm text-gray-600 dark:text-gray-400">{entry.email}</p>
                            {entry.authority === 'COORDINATOR' && (
                              <Badge className="mt-1 bg-maroon-600">Coordinator</Badge>
                            )}
                          </div>
                          <div className="flex gap-2" role="group" aria-label={`Attendance for ${entry.name}`}>
                            <Button
                              size="sm"
                              variant={current === SundaySchoolServantAttendanceStatus.PRESENT ? 'default' : 'outline'}
                              onClick={() => setMarks(previous => ({
                                ...previous,
                                [entry.userId]: SundaySchoolServantAttendanceStatus.PRESENT,
                              }))}
                              aria-pressed={current === SundaySchoolServantAttendanceStatus.PRESENT}
                            >
                              Present
                            </Button>
                            <Button
                              size="sm"
                              variant={current === SundaySchoolServantAttendanceStatus.ABSENT ? 'destructive' : 'outline'}
                              onClick={() => setMarks(previous => ({
                                ...previous,
                                [entry.userId]: SundaySchoolServantAttendanceStatus.ABSENT,
                              }))}
                              aria-pressed={current === SundaySchoolServantAttendanceStatus.ABSENT}
                            >
                              Absent
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

export default function ServantAttendancePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ServantAttendanceContent />
    </Suspense>
  )
}
