'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

interface Enrollment {
  id: string
  yearLevel: 'YEAR_1' | 'YEAR_2'
  student: {
    id: string
    name: string
    email: string
  }
}

interface StudentAnalytics {
  studentId: string
  studentName: string
  attendancePercentage: number
  attendanceMet: boolean
  examAverage: number
  examAverageMet: boolean
  sectionAverages: { [section: string]: number }
  allSectionsMet: boolean
  graduationEligible: boolean
  totalLessons: number
  presentCount: number
  lateCount: number
  absentCount: number
}

const SECTION_DISPLAY_NAMES: { [key: string]: string } = {
  BIBLE_STUDIES: 'Bible Studies',
  DOGMA: 'Dogma',
  COMPARATIVE_THEOLOGY: 'Comparative Theology',
  RITUAL_THEOLOGY_SACRAMENTS: 'Ritual Theology & Sacraments',
  CHURCH_HISTORY_COPTIC_HERITAGE: 'Church History & Coptic Heritage',
  SPIRITUALITY_OF_MENTOR: 'Spirituality of Mentor',
  PSYCHOLOGY_METHODOLOGY: 'Psychology & Methodology',
}

export default function MentorAnalyticsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [analytics, setAnalytics] = useState<StudentAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [academicYearId, setAcademicYearId] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role &&
               session.user.role !== 'MENTOR' &&
               session.user.role !== 'SUPER_ADMIN' &&
               session.user.role !== 'SERVANT_PREP') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user?.id) {
      fetchData()
    }
  }, [session?.user?.id])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Get active academic year
      const yearRes = await fetch('/api/academic-years')
      if (!yearRes.ok) throw new Error('Failed to fetch academic year')
      const years = await yearRes.json()
      const activeYear = years.find((y: any) => y.isActive)
      if (!activeYear) throw new Error('No active academic year')
      setAcademicYearId(activeYear.id)

      // Fetch only my assigned mentees
      const enrollmentRes = await fetch(`/api/enrollments?mentorId=${session?.user?.id}`)
      if (!enrollmentRes.ok) throw new Error('Failed to fetch mentees')
      const myEnrollments: Enrollment[] = await enrollmentRes.json()
      setEnrollments(myEnrollments)

      if (myEnrollments.length === 0) {
        setAnalytics([])
        setError('')
        return
      }

      // Get analytics for all students using batch API for better performance
      const studentIds = myEnrollments.map(e => e.student.id).join(',')
      const res = await fetch(
        `/api/students/analytics/batch?studentIds=${studentIds}&academicYearId=${activeYear.id}`
      )

      if (!res.ok) throw new Error('Failed to fetch analytics')
      const analyticsData = await res.json()
      setAnalytics(analyticsData)
      setError('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Mentee Analytics</h1>
          <p className="text-gray-600 mt-1">
            Detailed performance analytics for your {enrollments.length} assigned mentees
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {enrollments.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-gray-500 text-center">
                You do not have any mentees assigned to you yet. Contact an administrator to get students assigned.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {analytics.map((data) => (
              <Card key={data.studentId} className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl">{data.studentName}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        Student ID: {data.studentId.slice(0, 8)}...
                      </p>
                    </div>
                    <Badge
                      variant={data.graduationEligible ? 'default' : 'destructive'}
                      className="text-sm px-4 py-2"
                    >
                      {data.graduationEligible ? 'ON TRACK' : 'AT RISK'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {/* Attendance Section */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Attendance</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Attendance Rate</span>
                          <span className="font-semibold">
                            {data.attendancePercentage.toFixed(1)}%
                          </span>
                        </div>
                        <Progress
                          value={data.attendancePercentage}
                          className="h-3"
                        />
                        <div className="flex items-center gap-2 text-xs">
                          {data.attendanceMet ? (
                            <Badge variant="default" className="bg-green-600">✓ Requirement Met (≥75%)</Badge>
                          ) : (
                            <Badge variant="destructive">✗ Below Requirement (&lt;75%)</Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="bg-green-50 border border-green-200 rounded p-2 text-center">
                          <div className="text-2xl font-bold text-green-700">{data.presentCount}</div>
                          <div className="text-xs text-gray-600">Present</div>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-center">
                          <div className="text-2xl font-bold text-yellow-700">{data.lateCount}</div>
                          <div className="text-xs text-gray-600">Late</div>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded p-2 text-center">
                          <div className="text-2xl font-bold text-red-700">{data.absentCount}</div>
                          <div className="text-xs text-gray-600">Absent</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Exam Performance Section */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Exam Performance</h3>
                    <div className="space-y-3">
                      {/* Overall Average */}
                      <div className="bg-blue-50 border border-blue-200 rounded p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">Overall Average</span>
                          <span className="text-2xl font-bold">
                            {data.examAverage.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={data.examAverage} className="h-2 mb-2" />
                        {data.examAverageMet ? (
                          <Badge variant="default" className="bg-green-600 text-xs">✓ Requirement Met (≥75%)</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">✗ Below Requirement (&lt;75%)</Badge>
                        )}
                      </div>

                      {/* Section Breakdown */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(data.sectionAverages).map(([section, average]) => {
                          const passed = average >= 60
                          return (
                            <div
                              key={section}
                              className={`border rounded p-3 ${
                                passed
                                  ? 'bg-green-50 border-green-200'
                                  : 'bg-red-50 border-red-200'
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium">
                                  {SECTION_DISPLAY_NAMES[section] || section}
                                </span>
                                <span className="text-lg font-bold">
                                  {average.toFixed(1)}%
                                </span>
                              </div>
                              <Progress value={average} className="h-1 mb-1" />
                              <div className="text-xs text-gray-600">
                                {passed ? '✓ Passing (≥60%)' : '✗ Failing (<60%)'}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {data.allSectionsMet ? (
                        <Badge variant="default" className="bg-green-600">✓ All Sections Passed</Badge>
                      ) : (
                        <Badge variant="destructive">✗ Some Sections Below 60%</Badge>
                      )}
                    </div>
                  </div>

                  {/* Graduation Requirements Checklist */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Graduation Requirements</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center ${
                            data.attendanceMet
                              ? 'bg-green-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {data.attendanceMet ? '✓' : '✗'}
                        </div>
                        <span>Attendance ≥ 75%</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center ${
                            data.examAverageMet
                              ? 'bg-green-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {data.examAverageMet ? '✓' : '✗'}
                        </div>
                        <span>Overall exam average ≥ 75%</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center ${
                            data.allSectionsMet
                              ? 'bg-green-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {data.allSectionsMet ? '✓' : '✗'}
                        </div>
                        <span>All exam sections ≥ 60%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
