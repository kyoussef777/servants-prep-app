'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageLoading } from '@/components/ui/page-loading'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/admin/page-header'
import { useAdminGuard } from '@/hooks/useAdminGuard'
import { canAccessSundaySchool, canManageSundaySchoolClasses } from '@/lib/roles'
import { useSundaySchoolDashboard } from '@/lib/swr'
import { getLevelDisplayName } from '@/lib/sunday-school-class'
import type { SundaySchoolDashboard } from '@/types/sunday-school'
import { UserRole } from '@prisma/client'
import { Users, CalendarCheck, ClipboardList, ArrowRight, School } from 'lucide-react'

export default function SundaySchoolDashboardPage() {
  const { session, status } = useAdminGuard(canAccessSundaySchool)
  const { data, isLoading } = useSundaySchoolDashboard()

  if (status === 'loading' || isLoading) {
    return <PageLoading />
  }

  const dashboard = data as SundaySchoolDashboard | undefined
  const classes = dashboard?.classes ?? []
  const totals = dashboard?.totals
  const role = session?.user?.role as UserRole | undefined
  const canManage = role ? canManageSundaySchoolClasses(role) : false

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Sunday School"
          description={`Welcome, ${session?.user?.name ?? ''}. Take attendance and keep your class rosters up to date.`}
          actions={
            canManage ? (
              <Button asChild>
                <Link href="/dashboard/servants/classes">Manage classes</Link>
              </Button>
            ) : undefined
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

        <Card>
          <CardHeader>
            <CardTitle>My Classes</CardTitle>
          </CardHeader>
          <CardContent>
            {classes.length === 0 ? (
              <EmptyState
                message={
                  canManage
                    ? 'No classes yet. Create one to start building a roster and taking attendance.'
                    : 'You have not been assigned to a Sunday School class yet. Ask a Servants Prep leader to add you.'
                }
              />
            ) : (
              <div className="space-y-3">
                {classes.map(cls => (
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
                        {!cls.attendanceTakenThisWeek && (
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
                          Servants: {cls.servants.map(s => s.name).join(', ')}
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
                      <Button asChild size="sm">
                        <Link href={`/dashboard/servants/attendance?classId=${cls.id}`}>
                          Take attendance
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
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
