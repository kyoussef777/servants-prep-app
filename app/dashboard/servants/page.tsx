'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageLoading } from '@/components/ui/page-loading'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/admin/page-header'
import { useSundaySchoolGuard } from '@/hooks/useSundaySchoolGuard'
import { useSundaySchoolDashboard } from '@/lib/swr'
import { getLevelDisplayName } from '@/lib/sunday-school-class'
import type { SundaySchoolClassSummary, SundaySchoolDashboard } from '@/types/sunday-school'
import { Users, CalendarCheck, ClipboardList, ArrowRight, School } from 'lucide-react'

const UNBANDED = '__unbanded__'

export default function SundaySchoolDashboardPage() {
  const { session, status } = useSundaySchoolGuard()
  const { data, isLoading } = useSundaySchoolDashboard()

  const dashboard = data as SundaySchoolDashboard | undefined

  // An age-group coordinator runs several classes, so group the list by band.
  // A servant with one class sees a single group and never notices.
  const grouped = useMemo(() => {
    const classes = dashboard?.classes ?? []
    const buckets = new Map<string, { name: string; classes: SundaySchoolClassSummary[] }>()

    for (const cls of classes) {
      const key = cls.ageGroup?.id ?? UNBANDED
      const name = cls.ageGroup?.name ?? 'Other classes'
      if (!buckets.has(key)) buckets.set(key, { name, classes: [] })
      buckets.get(key)!.classes.push(cls)
    }

    const order = (dashboard?.ageGroups ?? []).map(g => g.id)
    return Array.from(buckets.entries()).sort((a, b) => {
      const ai = order.indexOf(a[0])
      const bi = order.indexOf(b[0])
      return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi)
    })
  }, [dashboard])

  if (status === 'loading' || isLoading) {
    return <PageLoading />
  }

  const totals = dashboard?.totals
  const standing = dashboard?.standing
  const classCount = dashboard?.classes.length ?? 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Sunday School"
          description={`Welcome, ${session?.user?.name ?? ''}. Take attendance and keep your class rosters up to date.`}
          actions={
            <div className="flex gap-2">
              {standing?.isAdmin && (
                <Button asChild variant="outline">
                  <Link href="/dashboard/servants/age-groups">Age groups</Link>
                </Button>
              )}
              <Button asChild>
                <Link href="/dashboard/servants/classes">Classes</Link>
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <School className="h-5 w-5 text-maroon-600" />
                <div>
                  <p className="text-2xl font-bold">{totals?.classes ?? 0}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Classes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-maroon-600" />
                <div>
                  <p className="text-2xl font-bold">{totals?.children ?? 0}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Children</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CalendarCheck className="h-5 w-5 text-maroon-600" />
                <div>
                  <p className="text-2xl font-bold">{totals?.classesNeedingAttendance ?? 0}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Need attendance this week</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {classCount === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                message={
                  standing?.isAdmin
                    ? 'No classes yet. Create one to start building a roster and taking attendance.'
                    : 'You have not been assigned to a Sunday School class yet. Ask your coordinator or a super admin to add you.'
                }
              />
            </CardContent>
          </Card>
        ) : (
          grouped.map(([key, band]) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle>{band.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {band.classes.map(cls => (
                    <div
                      key={cls.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg dark:border-gray-800"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/dashboard/servants/classes/${cls.id}`}
                            className="font-medium hover:underline"
                          >
                            {cls.name}
                          </Link>
                          <Badge variant="secondary">{getLevelDisplayName(cls.level)}</Badge>
                          {cls.canCoordinate && <Badge className="bg-maroon-600">Coordinator</Badge>}
                          {!cls.attendanceTakenThisWeek && cls.canServe && (
                            <Badge className="bg-yellow-600">Attendance due</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {cls.childCount} {cls.childCount === 1 ? 'child' : 'children'} ·{' '}
                          {cls.sessionCount} {cls.sessionCount === 1 ? 'session' : 'sessions'}
                          {cls.sessionCount > 0 && ` · ${cls.attendancePercentage.toFixed(0)}% attendance`}
                        </p>
                        {cls.servants.length > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            Servants:{' '}
                            {cls.servants
                              .map(s => (s.isCoordinator ? `${s.name} (coordinator)` : s.name))
                              .join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/dashboard/servants/children?classId=${cls.id}`}>
                            <ClipboardList className="h-4 w-4 mr-1" />
                            Roster
                          </Link>
                        </Button>
                        {cls.canServe && (
                          <Button asChild size="sm">
                            <Link href={`/dashboard/servants/attendance?classId=${cls.id}`}>
                              Take attendance
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
