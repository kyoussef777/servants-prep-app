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
import { useAdminGuard } from '@/hooks/useAdminGuard'
import { canAccessSundaySchool, canManageSundaySchoolClasses } from '@/lib/roles'
import { useSundaySchoolClass } from '@/lib/swr'
import { getChildFullName, getLevelDisplayName } from '@/lib/sunday-school-class'
import { formatDateUTC } from '@/lib/utils'
import type { SundaySchoolChild, SundaySchoolClass, SundaySchoolSession } from '@/types/sunday-school'
import { UserRole } from '@prisma/client'
import { ArrowLeft, ClipboardList, Trash2, UserPlus } from 'lucide-react'

interface ServantOption {
  id: string
  name: string
  email: string
}

interface ClassDetail extends SundaySchoolClass {
  children: SundaySchoolChild[]
  sessions: SundaySchoolSession[]
}

export default function SundaySchoolClassDetailPage() {
  const params = useParams<{ id: string }>()
  const classId = params?.id
  const { session, status } = useAdminGuard(canAccessSundaySchool)
  const { data, isLoading, mutate } = useSundaySchoolClass(classId)

  const [servantOptions, setServantOptions] = useState<ServantOption[]>([])
  const [selectedServantId, setSelectedServantId] = useState('')
  const [assigning, setAssigning] = useState(false)

  const role = session?.user?.role as UserRole | undefined
  const canManage = role ? canManageSundaySchoolClasses(role) : false

  // Only leaders can assign servants, so only they need the picker's options
  useEffect(() => {
    if (!canManage) return
    fetch('/api/users?role=SERVANT')
      .then(res => (res.ok ? res.json() : []))
      .then(users => setServantOptions(Array.isArray(users) ? users : []))
      .catch(() => setServantOptions([]))
  }, [canManage])

  const handleAssign = async () => {
    if (!selectedServantId || !classId) return

    setAssigning(true)
    try {
      const res = await fetch(`/api/sunday-school/classes/${classId}/servants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servantId: selectedServantId }),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || 'Failed to assign the servant')
      }

      toast.success('Servant assigned', { description: new Date().toLocaleString() })
      setSelectedServantId('')
      mutate()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign the servant')
    } finally {
      setAssigning(false)
    }
  }

  const handleUnassign = async (servantId: string) => {
    if (!classId) return
    try {
      const res = await fetch(
        `/api/sunday-school/classes/${classId}/servants?servantId=${servantId}`,
        { method: 'DELETE' }
      )
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

  const detail = data as ClassDetail | undefined

  if (!detail) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <EmptyState message="This class could not be found, or you do not have access to it." />
        </div>
      </div>
    )
  }

  const assignedIds = new Set(detail.servants.map(s => s.servantId))
  const availableServants = servantOptions.filter(s => !assignedIds.has(s.id))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
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
                <Link href={`/dashboard/servants/children?classId=${detail.id}`}>
                  <ClipboardList className="h-4 w-4 mr-1" />
                  Roster
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/dashboard/servants/attendance?classId=${detail.id}`}>
                  Take attendance
                </Link>
              </Button>
            </div>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Servants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.servants.length === 0 ? (
              <EmptyState message="No servants assigned to this class yet." />
            ) : (
              <div className="divide-y dark:divide-gray-800">
                {detail.servants.map(assignment => (
                  <div key={assignment.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{assignment.servant.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {assignment.servant.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {assignment.isLead && <Badge className="bg-maroon-600">Lead</Badge>}
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnassign(assignment.servantId)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canManage && (
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
                {detail.sessions.slice(0, 12).map(sessionItem => (
                  <div key={sessionItem.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{formatDateUTC(sessionItem.date)}</p>
                      {sessionItem.topic && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {sessionItem.topic}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400 shrink-0">
                      {sessionItem._count?.attendance ?? 0} marked
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
