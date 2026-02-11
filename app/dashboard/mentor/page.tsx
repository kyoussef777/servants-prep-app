'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEnrollments, useClassAverages, useMenteeAnalytics } from '@/lib/swr'
import { Users, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react'

interface ClassAverageSection {
  sectionId: string
  sectionName: string
  displayName: string
  average: number | null
  scoreCount: number
}

interface ClassAveragesData {
  sectionAverages: ClassAverageSection[]
  overallAverage: number | null
  totalStudents: number
  totalScores: number
}

interface StudentAnalytics {
  studentId: string
  studentName: string
  examAverage: number | null
  attendancePercentage: number | null
  attendanceMet: boolean
  examAverageMet: boolean
  graduationEligible: boolean
  sectionAverages: Record<string, number>
}

interface Enrollment {
  id: string
  studentId: string
  student: { id: string; name: string }
}

export default function MentorDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const userId = session?.user?.id
  const { data: enrollments } = useEnrollments(userId)
  const { data: classAverages, isLoading: classLoading } = useClassAverages()

  const menteeIds = useMemo(() => {
    if (!enrollments) return undefined
    const list = (enrollments as Enrollment[]).map((e: Enrollment) => e.studentId)
    return list.length > 0 ? list : undefined
  }, [enrollments])

  const { data: menteeAnalytics, isLoading: menteeLoading } = useMenteeAnalytics(menteeIds)

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

  // Compute mentee section averages
  const menteeSectionAverages = useMemo(() => {
    if (!menteeAnalytics || !Array.isArray(menteeAnalytics)) return {}
    const sectionTotals: Record<string, { sum: number; count: number }> = {}
    for (const student of menteeAnalytics as StudentAnalytics[]) {
      if (student.sectionAverages) {
        for (const [section, avg] of Object.entries(student.sectionAverages)) {
          if (!sectionTotals[section]) {
            sectionTotals[section] = { sum: 0, count: 0 }
          }
          sectionTotals[section].sum += avg
          sectionTotals[section].count += 1
        }
      }
    }
    const result: Record<string, number> = {}
    for (const [section, data] of Object.entries(sectionTotals)) {
      result[section] = data.sum / data.count
    }
    return result
  }, [menteeAnalytics])

  const menteeOverallExamAvg = useMemo(() => {
    if (!menteeAnalytics || !Array.isArray(menteeAnalytics)) return null
    const students = menteeAnalytics as StudentAnalytics[]
    const withScores = students.filter(s => s.examAverage !== null)
    if (withScores.length === 0) return null
    return withScores.reduce((sum, s) => sum + (s.examAverage ?? 0), 0) / withScores.length
  }, [menteeAnalytics])

  // Summary stats
  const menteeCount = menteeIds?.length ?? 0
  const onTrackCount = useMemo(() => {
    if (!menteeAnalytics || !Array.isArray(menteeAnalytics)) return 0
    return (menteeAnalytics as StudentAnalytics[]).filter(s => s.graduationEligible).length
  }, [menteeAnalytics])
  const atRiskCount = menteeCount - onTrackCount

  const isLoading = classLoading || menteeLoading

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const classData = classAverages as ClassAveragesData | undefined

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Mentor Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome, {session?.user?.name}</p>
          <p className="text-sm text-gray-500">Track your mentees&apos; performance against class averages</p>
        </div>

        {/* Quick Actions + Mentee Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{menteeCount}</p>
                  <p className="text-sm text-gray-500">Mentees</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{onTrackCount}</p>
                  <p className="text-sm text-gray-500">On Track</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{atRiskCount}</p>
                  <p className="text-sm text-gray-500">At Risk</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex items-center justify-center">
            <CardContent className="pt-6">
              <Link href="/dashboard/mentor/my-mentees">
                <Button className="w-full">
                  View Mentees <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Class Average vs My Mentees Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Exam Section Averages: Class vs My Mentees</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading averages...</div>
            ) : !classData || classData.sectionAverages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No exam data available yet.</div>
            ) : (
              <div className="space-y-4">
                {/* Overall Average Row */}
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <div className="font-semibold text-gray-900">Overall Average</div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 uppercase">Class</p>
                      <p className="text-lg font-bold">
                        {classData.overallAverage !== null
                          ? `${classData.overallAverage.toFixed(1)}%`
                          : '—'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 uppercase">My Mentees</p>
                      <p className="text-lg font-bold">
                        {menteeOverallExamAvg !== null
                          ? `${menteeOverallExamAvg.toFixed(1)}%`
                          : '—'}
                      </p>
                    </div>
                    <div className="text-center">
                      {classData.overallAverage !== null && menteeOverallExamAvg !== null ? (
                        <DiffBadge diff={menteeOverallExamAvg - classData.overallAverage} />
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section Header */}
                <div className="grid grid-cols-4 gap-4 px-4 text-xs text-gray-500 uppercase font-medium">
                  <div>Section</div>
                  <div className="text-center">Class Avg</div>
                  <div className="text-center">Mentees Avg</div>
                  <div className="text-center">Difference</div>
                </div>

                {/* Section Rows */}
                {classData.sectionAverages.map((section) => {
                  const menteeAvg = menteeSectionAverages[section.sectionName] ?? null
                  const diff = section.average !== null && menteeAvg !== null
                    ? menteeAvg - section.average
                    : null

                  return (
                    <div
                      key={section.sectionId}
                      className="grid grid-cols-4 gap-4 px-4 py-3 border-b last:border-b-0 items-center"
                    >
                      <div className="text-sm font-medium text-gray-700">
                        {section.displayName}
                      </div>
                      <div className="text-center text-sm">
                        {section.average !== null
                          ? `${section.average.toFixed(1)}%`
                          : '—'}
                      </div>
                      <div className="text-center text-sm">
                        {menteeAvg !== null
                          ? `${menteeAvg.toFixed(1)}%`
                          : '—'}
                      </div>
                      <div className="text-center">
                        {diff !== null ? (
                          <DiffBadge diff={diff} />
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Footer note */}
                <p className="text-xs text-gray-400 pt-2">
                  Class averages based on {classData.totalStudents} active students
                  ({classData.totalScores} exam scores).
                  {menteeCount === 0 && ' You have no mentees assigned yet.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DiffBadge({ diff }: { diff: number }) {
  const isPositive = diff > 0
  const isNeutral = Math.abs(diff) < 0.5

  if (isNeutral) {
    return (
      <Badge variant="outline" className="text-gray-600">
        0.0
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={isPositive
        ? 'text-green-700 border-green-300 bg-green-50'
        : 'text-red-700 border-red-300 bg-red-50'
      }
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3 mr-1 inline" />
      ) : (
        <TrendingDown className="h-3 w-3 mr-1 inline" />
      )}
      {isPositive ? '+' : ''}{diff.toFixed(1)}
    </Badge>
  )
}
