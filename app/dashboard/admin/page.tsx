'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { isAdmin, canAssignMentors, canManageUsers } from '@/lib/roles'
import { useDashboardStats } from '@/lib/swr'
import {
  Users,
  ClipboardCheck,
  GraduationCap,
  BookOpen,
  UserCheck,
  Clock,
  Settings,
  AlertTriangle,
  TrendingDown,
  BarChart3,
  Calendar
} from 'lucide-react'

interface ExamSectionScore {
  sectionId: string
  displayName: string
  average: number | null
  count: number
}

interface YearExamScores {
  yearId: string
  yearName: string
  isActive: boolean
  overallAverage: number | null
  sections: ExamSectionScore[]
}

interface YearAttendance {
  yearId: string
  yearName: string
  isActive: boolean
  present: number
  late: number
  absent: number
  excused: number
  total: number
  attendanceRate: number | null
}

interface AtRiskStudent {
  id: string
  name: string
  yearLevel: string
  attendanceRate: number | null
  examAverage: number | null
  issues: string[]
}

interface WeakSection {
  sectionId: string
  displayName: string
  average: number
  count: number
}

interface ProgramOverview {
  currentYearExams: number
  totalRelevantExams: number
  year1ExamsNeeded: number
  year2ExamsNeeded: number
  year1StudentCount: number
  year2StudentCount: number
  totalScoresRecorded: number
  overallProgramAverage: number | null
  studentsWithGoodAttendance: number
  studentsWithLowAttendance: number
  studentsWithGoodExams: number
  studentsWithLowExams: number
  studentsFullyOnTrack: number
  totalActiveStudents: number
}

interface Analytics {
  examScoresByYear: YearExamScores[]
  attendanceByYear: YearAttendance[]
  atRiskStudents: AtRiskStudent[]
  weakestSections: WeakSection[]
  totalAtRisk: number
  programOverview: ProgramOverview
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [, setAnalyticsLoading] = useState(true)

  // Use SWR for caching - automatically revalidates and caches
  const { data: stats, isLoading } = useDashboardStats()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role && !isAdmin(session.user.role)) {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch('/api/dashboard/analytics')
        if (res.ok) {
          const data = await res.json()
          setAnalytics(data)
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error)
      } finally {
        setAnalyticsLoading(false)
      }
    }

    if (status === 'authenticated') {
      fetchAnalytics()
    }
  }, [status])

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const userRole = session?.user?.role
  const canAssign = userRole ? canAssignMentors(userRole) : false
  const canManage = userRole ? canManageUsers(userRole) : false

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400'
    if (score >= 85) return 'text-green-600'
    if (score >= 75) return 'text-blue-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100'
    if (score >= 85) return 'bg-green-100'
    if (score >= 75) return 'bg-blue-100'
    if (score >= 60) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const activeYearExams = analytics?.examScoresByYear.find(y => y.isActive)
  const activeYearAttendance = analytics?.attendanceByYear.find(y => y.isActive)

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Settings Button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back, {session?.user?.name}</p>
          </div>
          <Link href="/dashboard/admin/settings">
            <Button variant="outline" size="sm" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </Link>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Students</CardTitle>
              <Users className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalStudents || 0}</div>
              <p className="text-xs text-gray-500 mt-1">
                {stats?.activeStudents || 0} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Lessons</CardTitle>
              <BookOpen className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalLessons || 0}</div>
              <p className="text-xs text-gray-500 mt-1">
                {stats?.completedLessons || 0} completed, {stats?.upcomingLessons || 0} upcoming
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Exams</CardTitle>
              <GraduationCap className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.programOverview?.totalRelevantExams || stats?.totalExams || 0}</div>
              <p className="text-xs text-gray-500 mt-1">
                {analytics?.programOverview?.totalScoresRecorded || 0} scores recorded
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">At-Risk Students</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{analytics?.totalAtRisk || 0}</div>
              <p className="text-xs text-gray-500 mt-1">
                Below 75% attendance or exams
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Program Health Overview */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Program Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <CardTitle>Program Overview</CardTitle>
                  <CardDescription>Students by year level</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {analytics?.programOverview ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <div className="text-2xl font-bold text-blue-700">
                        {analytics.programOverview.year1StudentCount}
                      </div>
                      <div className="text-xs text-blue-600">Year 1 Students</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {analytics.programOverview.year1ExamsNeeded} exams
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
                      <div className="text-2xl font-bold text-purple-700">
                        {analytics.programOverview.year2StudentCount}
                      </div>
                      <div className="text-xs text-purple-600">Year 2 Students</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {analytics.programOverview.year2ExamsNeeded} exams total
                      </div>
                    </div>
                  </div>

                  {/* Student Threshold Stats */}
                  <div className="pt-3 border-t space-y-2">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Graduation Track (≥75% both)</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded bg-green-50 border border-green-200 text-center">
                        <div className="text-xl font-bold text-green-700">
                          {analytics.programOverview.studentsFullyOnTrack}
                        </div>
                        <div className="text-xs text-green-600">On Track</div>
                      </div>
                      <div className="p-2 rounded bg-red-50 border border-red-200 text-center">
                        <div className="text-xl font-bold text-red-700">
                          {analytics.programOverview.totalActiveStudents - analytics.programOverview.studentsFullyOnTrack}
                        </div>
                        <div className="text-xs text-red-600">Need Support</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 text-center">
                      Attendance + Exam avg both ≥75%
                    </div>
                  </div>

                  {analytics.programOverview.overallProgramAverage !== null && (
                    <div className="pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Program Exam Average</span>
                        <span className={`font-bold ${getScoreColor(analytics.programOverview.overallProgramAverage)}`}>
                          {analytics.programOverview.overallProgramAverage.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  Loading...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Year Attendance */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-maroon-600" />
                <div>
                  <CardTitle>Attendance Overview</CardTitle>
                  <CardDescription>{activeYearAttendance?.yearName || 'Current Year'}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activeYearAttendance ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Overall Rate</span>
                    <span className={`text-2xl font-bold ${getScoreColor(activeYearAttendance.attendanceRate)}`}>
                      {activeYearAttendance.attendanceRate?.toFixed(2) || '—'}%
                    </span>
                  </div>
                  <Progress
                    value={activeYearAttendance.attendanceRate || 0}
                    className="h-2"
                  />
                  <div className="grid grid-cols-4 gap-2 text-center text-sm">
                    <div className="p-2 rounded bg-green-50">
                      <div className="font-semibold text-green-700">{activeYearAttendance.present}</div>
                      <div className="text-xs text-green-600">Present</div>
                    </div>
                    <div className="p-2 rounded bg-yellow-50">
                      <div className="font-semibold text-yellow-700">{activeYearAttendance.late}</div>
                      <div className="text-xs text-yellow-600">Late</div>
                    </div>
                    <div className="p-2 rounded bg-red-50">
                      <div className="font-semibold text-red-700">{activeYearAttendance.absent}</div>
                      <div className="text-xs text-red-600">Absent</div>
                    </div>
                    <div className="p-2 rounded bg-gray-50">
                      <div className="font-semibold text-gray-700">{activeYearAttendance.excused}</div>
                      <div className="text-xs text-gray-600">Excused</div>
                    </div>
                  </div>

                  {/* Student Attendance Thresholds */}
                  {analytics?.programOverview && (
                    <div className="pt-3 border-t space-y-2">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Student Attendance (≥75%)</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded bg-green-50 border border-green-200 text-center">
                          <div className="text-xl font-bold text-green-700">
                            {analytics.programOverview.studentsWithGoodAttendance}
                          </div>
                          <div className="text-xs text-green-600">On Track</div>
                        </div>
                        <div className="p-2 rounded bg-red-50 border border-red-200 text-center">
                          <div className="text-xl font-bold text-red-700">
                            {analytics.programOverview.studentsWithLowAttendance}
                          </div>
                          <div className="text-xs text-red-600">Below 75%</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No attendance data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weakest Sections */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                <div>
                  <CardTitle>Areas Needing Attention</CardTitle>
                  <CardDescription>Lowest scoring exam sections</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {analytics?.weakestSections && analytics.weakestSections.length > 0 ? (
                <div className="space-y-3">
                  {analytics.weakestSections.map((section, index) => (
                    <div key={section.sectionId} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-400">#{index + 1}</span>
                        <div>
                          <p className="font-medium text-sm">{section.displayName}</p>
                          <p className="text-xs text-gray-500">{section.count} scores recorded</p>
                        </div>
                      </div>
                      <Badge className={`${getScoreBgColor(section.average)} ${getScoreColor(section.average)} border-0`}>
                        {section.average.toFixed(2)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No exam data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Exam Scores by Section */}
        {activeYearExams && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                <div>
                  <CardTitle>Exam Performance by Section</CardTitle>
                  <CardDescription>{activeYearExams.yearName} - Overall Average: {activeYearExams.overallAverage?.toFixed(2) || '—'}%</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {activeYearExams.sections.map(section => (
                  <div
                    key={section.sectionId}
                    className={`p-4 rounded-lg border ${section.average !== null ? getScoreBgColor(section.average) : 'bg-gray-50'}`}
                  >
                    <p className="text-sm font-medium truncate" title={section.displayName}>
                      {section.displayName}
                    </p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className={`text-xl font-bold ${getScoreColor(section.average)}`}>
                        {section.average?.toFixed(2) || '—'}
                      </span>
                      {section.average !== null && <span className="text-sm text-gray-500">%</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {section.count} {section.count === 1 ? 'score' : 'scores'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Year-over-Year Comparison */}
        {analytics?.attendanceByYear && analytics.attendanceByYear.length > 1 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <div>
                  <CardTitle>Year-over-Year Comparison</CardTitle>
                  <CardDescription>Attendance and exam trends across academic years</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Academic Year</th>
                      <th className="text-center py-2 px-3 font-medium">Attendance Rate</th>
                      <th className="text-center py-2 px-3 font-medium">Exam Average</th>
                      <th className="text-center py-2 px-3 font-medium">Total Records</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.attendanceByYear.map(year => {
                      const examYear = analytics.examScoresByYear.find(e => e.yearId === year.yearId)
                      return (
                        <tr key={year.yearId} className={`border-b ${year.isActive ? 'bg-blue-50' : ''}`}>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              {year.yearName}
                              {year.isActive && (
                                <Badge variant="outline" className="text-xs">Active</Badge>
                              )}
                            </div>
                          </td>
                          <td className={`text-center py-2 px-3 font-medium ${getScoreColor(year.attendanceRate)}`}>
                            {year.attendanceRate?.toFixed(2) || '—'}%
                          </td>
                          <td className={`text-center py-2 px-3 font-medium ${getScoreColor(examYear?.overallAverage ?? null)}`}>
                            {examYear?.overallAverage?.toFixed(2) || '—'}%
                          </td>
                          <td className="text-center py-2 px-3 text-gray-500">
                            {year.total} attendance
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alerts and Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* At-Risk Students */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Students Needing Support
            </h2>

            {analytics?.atRiskStudents && analytics.atRiskStudents.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {analytics.atRiskStudents.slice(0, 5).map(student => (
                      <div key={student.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                        <div>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-xs text-gray-500">Year {student.yearLevel === 'YEAR_1' ? '1' : '2'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            {student.attendanceRate !== null && (
                              <p className={`text-sm ${getScoreColor(student.attendanceRate)}`}>
                                {student.attendanceRate.toFixed(2)}% attendance
                              </p>
                            )}
                            {student.examAverage !== null && (
                              <p className={`text-sm ${getScoreColor(student.examAverage)}`}>
                                {student.examAverage.toFixed(2)}% exam avg
                              </p>
                            )}
                          </div>
                          <Link href={`/dashboard/admin/students?student=${student.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                  {analytics.totalAtRisk > 5 && (
                    <div className="p-3 text-center border-t bg-gray-50">
                      <Link href="/dashboard/admin/students" className="text-sm text-maroon-600 hover:underline">
                        View all {analytics.totalAtRisk} at-risk students →
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="py-6 text-center">
                  <p className="text-green-800">All students are on track!</p>
                  <p className="text-sm text-green-600 mt-1">No students below 75% threshold</p>
                </CardContent>
              </Card>
            )}

            {/* Other Alerts */}
            {stats && stats.unassignedStudents > 0 && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-yellow-600" />
                    <CardTitle className="text-yellow-900">Unassigned Students</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-yellow-800 mb-3">
                    {stats.unassignedStudents} student{stats.unassignedStudents !== 1 ? 's' : ''} {stats.unassignedStudents !== 1 ? 'need' : 'needs'} a mentor assignment
                  </p>
                  {canAssign && (
                    <Link href="/dashboard/admin/enrollments">
                      <Button size="sm" variant="outline" className="border-yellow-300 text-yellow-700 hover:bg-yellow-100">
                        Assign Mentors
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}

            {stats && stats.upcomingLessons > 0 && (
              <Card className="border-maroon-200 bg-maroon-50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-maroon-600" />
                    <CardTitle className="text-maroon-900">Upcoming Lessons</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-maroon-800 mb-3">
                    {stats.upcomingLessons} lesson{stats.upcomingLessons !== 1 ? 's' : ''} scheduled
                  </p>
                  <Link href="/dashboard/admin/curriculum">
                    <Button size="sm" variant="outline" className="border-maroon-300 text-maroon-700 hover:bg-maroon-100">
                      View Schedule
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Quick Actions</h2>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-maroon-600" />
                  <CardTitle className="text-base">Take Attendance</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard/admin/attendance">
                  <Button className="w-full" size="sm">Mark Attendance</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-base">Enter Exam Scores</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard/admin/exams">
                  <Button className="w-full" size="sm">Manage Exams</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-base">Add Lesson</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard/admin/curriculum">
                  <Button className="w-full" size="sm" variant="outline">Manage Curriculum</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-base">View My Mentees</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard/admin/mentees">
                  <Button className="w-full" size="sm" variant="outline">View Mentees</Button>
                </Link>
              </CardContent>
            </Card>

            {canManage && (
              <Card className="hover:shadow-md transition-shadow border-purple-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    <CardTitle className="text-base">Manage Users</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <Link href="/dashboard/admin/users">
                    <Button className="w-full" size="sm" variant="outline">User Management</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
