'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { PageLoading } from '@/components/ui/page-loading'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/admin/page-header'
import { useSundaySchoolGuard } from '@/hooks/useSundaySchoolGuard'
import { useSundaySchoolClass } from '@/lib/swr'
import { getChildFullName, getLevelDisplayName } from '@/lib/sunday-school-class'
import { formatDateUTC } from '@/lib/utils'
import type {
  SundaySchoolAssignmentRow,
  SundaySchoolChild,
  SundaySchoolClass,
  SundaySchoolSession,
  SundaySchoolWeeklyLesson,
} from '@/types/sunday-school'
import { SundaySchoolAuthority } from '@prisma/client'
import { ArrowLeft, ClipboardList, ExternalLink, Trash2, UserPlus } from 'lucide-react'

interface ServantOption {
  id: string
  name: string
  email: string
  role: string
}

interface ClassDetail extends SundaySchoolClass {
  children: SundaySchoolChild[]
  sessions: SundaySchoolSession[]
  weeklyLessons: SundaySchoolWeeklyLesson[]
  canServe: boolean
  canCoordinate: boolean
  canDelete: boolean
  canTakeServantAttendance: boolean
}

export default function SundaySchoolClassDetailPage() {
  const params = useParams<{ id: string }>()
  const classId = params?.id
  const { status } = useSundaySchoolGuard()
  const { data, isLoading, mutate } = useSundaySchoolClass(classId)

  const [servantOptions, setServantOptions] = useState<ServantOption[]>([])
  const [selectedServantId, setSelectedServantId] = useState('')
  const [asCoordinator, setAsCoordinator] = useState(false)
  const [assigning, setAssigning] = useState(false)

  const detail = data as ClassDetail | undefined
  const canCoordinate = detail?.canCoordinate ?? false

  // Only someone who can staff this class needs the picker's options. This
  // endpoint exists precisely so a coordinator who is a plain servant does not
  // need /api/users, which is admin-only.
  useEffect(() => {
    if (!canCoordinate) return
    fetch('/api/sunday-school/assignable-servants')
      .then(res => (res.ok ? res.json() : []))
      .then(users => setServantOptions(Array.isArray(users) ? users : []))
      .catch(() => setServantOptions([]))
  }, [canCoordinate])

  const handleAssign = async () => {
    if (!selectedServantId || !classId) return

    setAssigning(true)
    try {
      const res = await fetch('/api/sunday-school/servant-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedServantId,
          classId,
          authority: asCoordinator
            ? SundaySchoolAuthority.COORDINATOR
            : SundaySchoolAuthority.SERVANT,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || 'Failed to assign the servant')
      }

      toast.success('Servant assigned', { description: new Date().toLocaleString() })
      setSelectedServantId('')
      setAsCoordinator(false)
      mutate()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign the servant')
    } finally {
      setAssigning(false)
    }
  }

  const handleUnassign = async (assignmentId: string) => {
    try {
      const res = await fetch(`/api/sunday-school/servant-assignments?id=${assignmentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Failed to remove the servant')
      }
      toast.success('Servant removed')
      mutate()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove the servant')
    }
  }

  if (status === 'loading' || isLoading) {
    return <PageLoading />
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <EmptyState message="This class could not be found, or you do not have access to it." />
        </div>
      </div>
    )
  }

  const classAssignments = (detail.assignments ?? []).filter(
    (a: SundaySchoolAssignmentRow) => a.classId === detail.id
  )
  const assignedIds = new Set(classAssignments.map(a => a.userId))
  const availableServants = servantOptions.filter(s => !assignedIds.has(s.id))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard/servants/classes">
            <ArrowLeft className="h-4 w-4 mr-1" />
            All classes
          </Link>
        </Button>

        <PageHeader
          title={detail.name}
          description={`${getLevelDisplayName(detail.level)} · ${detail.children.length} children`}
          actions={
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/dashboard/servants/lessons">Lessons</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/dashboard/servants/roster?classId=${detail.id}`}>
                  <ClipboardList className="h-4 w-4 mr-1" />
                  Roster
                </Link>
              </Button>
              {detail.canServe && (
                <Button asChild>
                  <Link href={`/dashboard/servants/attendance?classId=${detail.id}`}>
                    Take attendance
                  </Link>
                </Button>
              )}
              {detail.canTakeServantAttendance && (
                <Button asChild variant="outline">
                  <Link href={`/dashboard/servants/servant-attendance?classId=${detail.id}`}>
                    Servant attendance
                  </Link>
                </Button>
              )}
            </div>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Servants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {classAssignments.length === 0 ? (
              <EmptyState message="No servants assigned to this class yet." />
            ) : (
              <div className="divide-y dark:divide-gray-800">
                {classAssignments.map(assignment => (
                  <div key={assignment.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{assignment.user.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {assignment.user.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {assignment.authority === SundaySchoolAuthority.COORDINATOR && (
                        <Badge className="bg-maroon-600">Coordinator</Badge>
                      )}
                      {canCoordinate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnassign(assignment.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canCoordinate && (
              <div className="flex flex-col sm:flex-row sm:items-end gap-2 pt-2 border-t dark:border-gray-800">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="servant">Assign a servant</Label>
                  <select
                    id="servant"
                    value={selectedServantId}
                    onChange={e => setSelectedServantId(e.target.value)}
                    className="w-full h-9 rounded-md border px-3 text-sm bg-white dark:bg-gray-900 dark:border-gray-700"
                  >
                    <option value="">Select a servant…</option>
                    {availableServants.map(servant => (
                      <option key={servant.id} value={servant.id}>
                        {servant.name} ({servant.email})
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm h-9">
                  <input
                    type="checkbox"
                    checked={asCoordinator}
                    onChange={e => setAsCoordinator(e.target.checked)}
                  />
                  Coordinator
                </label>
                <Button onClick={handleAssign} disabled={!selectedServantId || assigning}>
                  <UserPlus className="h-4 w-4 mr-1" />
                  {assigning ? 'Assigning…' : 'Assign'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roster</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.children.length === 0 ? (
              <EmptyState message="No children on this roster yet." />
            ) : (
              <div className="divide-y dark:divide-gray-800">
                {detail.children.map(child => (
                  <div key={child.id} className="flex items-center justify-between gap-3 py-3">
                    <p className={`font-medium ${child.isActive ? '' : 'text-gray-400 line-through'}`}>
                      {getChildFullName(child)}
                    </p>
                    <Badge variant="secondary">{getLevelDisplayName(child.level)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.sessions.length === 0 ? (
              <EmptyState message="No attendance has been taken for this class yet." />
            ) : (
              <div className="divide-y dark:divide-gray-800">
                {detail.sessions.slice(0, 12).map(sessionItem => {
                  const lesson = detail.weeklyLessons?.find(item => item.sundayDate.slice(0, 10) === sessionItem.date.slice(0, 10))
                  return (
                    <div key={sessionItem.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="font-medium">{formatDateUTC(sessionItem.date)}</p>
                        {(lesson?.title || sessionItem.topic) && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {lesson?.title || sessionItem.topic}
                          </p>
                        )}
                        {lesson && lesson.resources.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-3">
                            {lesson.resources.map(resource => (
                              <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-maroon-700 hover:underline dark:text-maroon-300">
                                <ExternalLink className="h-3.5 w-3.5" /> {resource.title}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400 shrink-0">
                        {sessionItem._count?.attendance ?? 0} marked
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
