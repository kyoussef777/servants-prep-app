'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageLoading } from '@/components/ui/page-loading'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/admin/page-header'
import { AttendanceStatusButtons } from '@/components/attendance-status-buttons'
import { useSundaySchoolGuard } from '@/hooks/useSundaySchoolGuard'
import { useSundaySchoolClasses } from '@/lib/swr'
import {
  getChildFullName,
  getLevelDisplayName,
  getMostRecentSunday,
  getTodayDateInputValue,
  toDateInputValue,
} from '@/lib/sunday-school-class'
import type {
  SundaySchoolChild,
  SundaySchoolClass,
  SundaySchoolRosterEntry,
  SundaySchoolSession,
  SundaySchoolSessionAttendance,
} from '@/types/sunday-school'
import { AttendanceStatus } from '@prisma/client'
import { Save } from 'lucide-react'

function SundaySchoolAttendanceContent() {
  const { status } = useSundaySchoolGuard()
  const searchParams = useSearchParams()

  const { data: classesData, isLoading: classesLoading } = useSundaySchoolClasses()
  const classes = useMemo(() => (classesData as SundaySchoolClass[] | undefined) ?? [], [classesData])

  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [sessionDate, setSessionDate] = useState<string>(toDateInputValue(getMostRecentSunday()))
  const [attendance, setAttendance] = useState<SundaySchoolSessionAttendance | null>(null)
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({})
  const [loadingSession, setLoadingSession] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // The server decides per class whether this person may record attendance
  const selectedClass = classes.find(c => c.id === selectedClassId)
  const canEdit = selectedClass?.canServe ?? false

  // Preselect the class from the dashboard link, else the first one available
  useEffect(() => {
    if (selectedClassId || classes.length === 0) return
    const fromQuery = searchParams.get('classId')
    const match = fromQuery && classes.some(c => c.id === fromQuery) ? fromQuery : classes[0].id
    setSelectedClassId(match)
  }, [classes, searchParams, selectedClassId])

  // Load the roster for the selected class + date. Read-only: the session row
  // is only created on save, so browsing dates never leaves empty sessions
  // behind (and PRIEST, who cannot write, can still look).
  const loadSession = useCallback(async () => {
    if (!selectedClassId || !sessionDate) return

    setLoadingSession(true)
    try {
      const sessionsRes = await fetch(
        `/api/sunday-school/sessions?classId=${selectedClassId}&from=${sessionDate}&to=${sessionDate}`
      )
      const sessionsBody = await sessionsRes.json()
      if (!sessionsRes.ok) {
        throw new Error(sessionsBody.error || 'Failed to look up the session')
      }

      const existing = (sessionsBody as SundaySchoolSession[])[0]

      if (existing) {
        const attendanceRes = await fetch(`/api/sunday-school/sessions/${existing.id}/attendance`)
        const attendanceBody = await attendanceRes.json()
        if (!attendanceRes.ok) {
          throw new Error(attendanceBody.error || 'Failed to load the roster')
        }
        const loaded = attendanceBody as SundaySchoolSessionAttendance
        setAttendance(loaded)
        setMarks(
          Object.fromEntries(
            loaded.roster.map(entry => [
              entry.id,
              entry.attendance?.status ?? AttendanceStatus.PRESENT,
            ])
          )
        )
        return
      }

      // No session recorded for this date yet — show the class roster unmarked
      const childrenRes = await fetch(`/api/sunday-school/children?classId=${selectedClassId}&isActive=true`)
      const childrenBody = await childrenRes.json()
      if (!childrenRes.ok) {
        throw new Error(childrenBody.error || 'Failed to load the roster')
      }

      const roster: SundaySchoolRosterEntry[] = (childrenBody as SundaySchoolChild[]).map(child => ({
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        level: child.level,
        attendance: null,
      }))

      setAttendance({ session: null, roster })
      setMarks(Object.fromEntries(roster.map(entry => [entry.id, AttendanceStatus.PRESENT])))
    } catch (error: unknown) {
      setAttendance(null)
      setMarks({})
      toast.error(error instanceof Error ? error.message : 'Failed to load attendance')
    } finally {
      setLoadingSession(false)
    }
  }, [selectedClassId, sessionDate])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  const handleSave = async () => {
    if (!attendance) return

    setSaving(true)
    try {
      // Create the session on first save (the route is idempotent, so a
      // re-save of an existing date reuses it)
      const sessionRes = await fetch('/api/sunday-school/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClassId, date: sessionDate }),
      })
      const sessionBody = await sessionRes.json()
      if (!sessionRes.ok) {
        throw new Error(sessionBody.error || 'Failed to open the session')
      }

      const res = await fetch('/api/sunday-school/attendance/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionBody.id,
          records: attendance.roster.map(entry => ({
            childId: entry.id,
            status: marks[entry.id] ?? AttendanceStatus.PRESENT,
          })),
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || 'Failed to save attendance')
      }

      const saved = new Date()
      setLastSaved(saved)
      setAttendance(prev => (prev ? { ...prev, session: sessionBody } : prev))
      toast.success('Attendance saved', { description: saved.toLocaleString() })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  const markAll = (value: AttendanceStatus) => {
    if (!attendance) return
    setMarks(Object.fromEntries(attendance.roster.map(entry => [entry.id, value])))
  }

  const presentCount = useMemo(
    () => Object.values(marks).filter(s => s === AttendanceStatus.PRESENT || s === AttendanceStatus.LATE).length,
    [marks]
  )

  if (status === 'loading' || classesLoading) {
    return <PageLoading />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader
          title="Take Attendance"
          description="Mark each child in your class for the week."
          lastSaved={lastSaved}
          actions={
            canEdit && attendance ? (
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
            ) : undefined
          }
        />

        {classes.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState message="You are not assigned to any Sunday School class yet." />
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="class">Class</Label>
                  <select
                    id="class"
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value)}
                    className="w-full h-9 rounded-md border px-3 text-sm bg-white dark:bg-gray-900 dark:border-gray-700"
                  >
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} — {getLevelDisplayName(cls.level)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Week of</Label>
                  <Input
                    id="date"
                    type="date"
                    value={sessionDate}
                    max={getTodayDateInputValue()}
                    onChange={e => setSessionDate(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>
                  {selectedClass?.name ?? 'Roster'}
                  {attendance && (
                    <span className="ml-2 text-sm font-normal text-gray-600 dark:text-gray-400">
                      {presentCount} of {attendance.roster.length} here
                    </span>
                  )}
                </CardTitle>
                {canEdit && attendance && attendance.roster.length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => markAll(AttendanceStatus.PRESENT)}>
                      All present
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => markAll(AttendanceStatus.ABSENT)}>
                      All absent
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {loadingSession ? (
                  <p className="text-center py-8 text-gray-500">Loading roster…</p>
                ) : !attendance || attendance.roster.length === 0 ? (
                  <EmptyState message="No children on this roster yet. Add them from the Children page." />
                ) : (
                  <div className="divide-y dark:divide-gray-800">
                    {attendance.roster.map(entry => (
                      <div key={entry.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{getChildFullName(entry)}</p>
                          <Badge variant="secondary" className="mt-1">
                            {getLevelDisplayName(entry.level)}
                          </Badge>
                        </div>
                        <AttendanceStatusButtons
                          currentStatus={marks[entry.id] ?? AttendanceStatus.PRESENT}
                          onStatusChange={statusValue =>
                            setMarks(prev => ({ ...prev, [entry.id]: statusValue as AttendanceStatus }))
                          }
                          disabled={!canEdit}
                        />
                      </div>
                    ))}
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

export default function SundaySchoolAttendancePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <SundaySchoolAttendanceContent />
    </Suspense>
  )
}
