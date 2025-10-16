'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { isAdmin, canAssignMentors, canManageUsers, getRoleDisplayName } from '@/lib/roles'
import {
  Users,
  Calendar,
  ClipboardCheck,
  GraduationCap,
  BookOpen,
  UserCheck,
  AlertCircle,
  TrendingUp,
  Clock,
  CheckCircle2
} from 'lucide-react'

interface DashboardStats {
  totalStudents: number
  activeStudents: number
  totalLessons: number
  upcomingLessons: number
  completedLessons: number
  totalExams: number
  unassignedStudents: number
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role && !isAdmin(session.user.role)) {
      router.push('/dashboard')
    } else if (status === 'authenticated') {
      fetchDashboardStats()
    }
  }, [status, session, router])

  const fetchDashboardStats = async () => {
    try {
      // First fetch active academic year
      const yearsRes = await fetch('/api/academic-years')
      if (!yearsRes.ok) {
        setLoading(false)
        return
      }
      const years = await yearsRes.json()
      const activeYear = years.find((y: any) => y.isActive)

      if (!activeYear) {
        setLoading(false)
        return
      }

      // Fetch all necessary data in parallel
      const [studentsRes, lessonsRes, examsRes, enrollmentsRes] = await Promise.all([
        fetch('/api/users?role=STUDENT'),
        fetch('/api/lessons'),
        fetch('/api/exams'),
        fetch('/api/enrollments')
      ])

      const students = await studentsRes.json()
      const lessons = await lessonsRes.json()
      const exams = await examsRes.json()
      const enrollments = await enrollmentsRes.json()

      const now = new Date()
      const activeStudents = students.filter((s: any) =>
        s.enrollments?.some((e: any) => e.isActive)
      )

      const upcomingLessons = lessons.filter((l: any) =>
        new Date(l.scheduledDate) > now && l.status === 'SCHEDULED'
      )

      const completedLessons = lessons.filter((l: any) =>
        l.status === 'COMPLETED'
      )

      const unassignedStudents = enrollments.filter((e: any) =>
        e.isActive && !e.mentorId
      ).length

      setStats({
        totalStudents: students.length,
        activeStudents: activeStudents.length,
        totalLessons: lessons.length,
        upcomingLessons: upcomingLessons.length,
        completedLessons: completedLessons.length,
        totalExams: exams.length,
        unassignedStudents
      })
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const userRole = session?.user?.role
  const canAssign = userRole ? canAssignMentors(userRole) : false
  const canManage = userRole ? canManageUsers(userRole) : false

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back, {session?.user?.name}</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <CardTitle className="text-sm font-medium text-gray-600">Total Exams</CardTitle>
              <GraduationCap className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalExams || 0}</div>
              <p className="text-xs text-gray-500 mt-1">
                Created exams
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts and Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Alerts */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold">Alerts & Notifications</h2>

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
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-blue-900">Upcoming Lessons</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-blue-800 mb-3">
                    {stats.upcomingLessons} lesson{stats.upcomingLessons !== 1 ? 's' : ''} scheduled
                  </p>
                  <Link href="/dashboard/admin/curriculum">
                    <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
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
                  <ClipboardCheck className="h-5 w-5 text-blue-600" />
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
