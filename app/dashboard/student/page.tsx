'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

interface MissingExam {
  id: string
  examDate: string
  totalPoints: number
  yearLevel: string
  sectionName: string
  sectionDisplayName: string
}

interface Analytics {
  enrollment: {
    id: string
    yearLevel: 'YEAR_1' | 'YEAR_2'
    isActive: boolean
    status: string
    mentor: {
      id: string
      name: string
      email: string
    } | null
    student: {
      id: string
      name: string
      email: string
    }
  }
  attendance: {
    totalLessons: number
    allLessons: number
    presentCount: number
    lateCount: number
    absentCount: number
    excusedCount: number
    effectivePresent: number
    percentage: number | null
    met: boolean
    required: number
  }
  exams: {
    sectionAverages: Array<{
      section: string
      average: number
      scores: number[]
      passingMet: boolean
    }>
    overallAverage: number | null
    overallAverageMet: boolean
    allSectionsPassing: boolean
    requiredAverage: number
    requiredMinimum: number
    missingExams: MissingExam[]
    totalApplicableExams: number
    examsTaken: number
  }
  graduation: {
    eligible: boolean
    attendanceMet: boolean
    overallAverageMet: boolean
    allSectionsPassing: boolean
  }
}

export default function StudentDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [, setAcademicYearId] = useState<string | null>(null)
  const [academicYearName, setAcademicYearName] = useState<string>('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role !== 'STUDENT') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user?.id) return

      try {
        // Get active academic year
        const yearsRes = await fetch('/api/academic-years')
        const years = await yearsRes.json()
        const activeYear = years.find((y: { isActive: boolean }) => y.isActive)

        if (activeYear) {
          setAcademicYearId(activeYear.id)
          setAcademicYearName(activeYear.name)
        }

        // Fetch analytics (no academicYearId filter - aggregate across ALL years for graduation tracking)
        const analyticsRes = await fetch(
          `/api/students/${session.user.id}/analytics`
        )

        if (analyticsRes.ok) {
          const data = await analyticsRes.json()
          setAnalytics(data)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchData()
    }
  }, [session])

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">No enrollment found for the current academic year.</p>
        </div>
      </div>
    )
  }

  const sectionDisplayNames: { [key: string]: string } = {
    BIBLE_STUDIES: 'Bible Studies',
    DOGMA: 'Dogma',
    COMPARATIVE_THEOLOGY: 'Comparative Theology',
    RITUAL_THEOLOGY_SACRAMENTS: 'Ritual Theology & Sacraments',
    CHURCH_HISTORY_COPTIC_HERITAGE: 'Church History & Coptic Heritage',
    SPIRITUALITY_OF_SERVANT: 'Spirituality of the Servant',
    PSYCHOLOGY_METHODOLOGY: 'Psychology & Methodology',
    MISCELLANEOUS: 'Miscellaneous',
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {session?.user?.name}</h1>
            <p className="text-gray-600 mt-1">
              Year {analytics.enrollment.yearLevel === 'YEAR_1' ? '1' : '2'} Student{academicYearName ? ` - ${academicYearName}` : ''}
            </p>
            {analytics.enrollment.mentor && (
              <p className="text-gray-600">
                Mentor: {analytics.enrollment.mentor.name}
              </p>
            )}
          </div>
          <button
            onClick={() => router.push('/dashboard/student/lessons')}
            className="px-4 py-2 bg-maroon-600 text-white rounded-md hover:bg-maroon-700 transition-colors text-sm font-medium"
          >
            View My Lessons
          </button>
        </div>

        {/* Graduation Status */}
        <Card className={analytics.graduation.eligible ? 'border-green-500' : 'border-yellow-500'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              GRADUATION STATUS:
              {analytics.graduation.eligible ? (
                <Badge className="bg-green-500">ON TRACK</Badge>
              ) : (
                <Badge className="bg-yellow-500">AT RISK</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className={`p-3 rounded border text-center ${analytics.graduation.attendanceMet ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-2xl mb-1">{analytics.graduation.attendanceMet ? '✓' : '✗'}</div>
                <div className={`text-sm font-medium ${analytics.graduation.attendanceMet ? 'text-green-700' : 'text-red-700'}`}>
                  Attendance ≥75%
                </div>
              </div>
              <div className={`p-3 rounded border text-center ${analytics.graduation.overallAverageMet ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-2xl mb-1">{analytics.graduation.overallAverageMet ? '✓' : '✗'}</div>
                <div className={`text-sm font-medium ${analytics.graduation.overallAverageMet ? 'text-green-700' : 'text-red-700'}`}>
                  Exam Avg ≥75%
                </div>
              </div>
              <div className={`p-3 rounded border text-center ${analytics.graduation.allSectionsPassing ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-2xl mb-1">{analytics.graduation.allSectionsPassing ? '✓' : '✗'}</div>
                <div className={`text-sm font-medium ${analytics.graduation.allSectionsPassing ? 'text-green-700' : 'text-red-700'}`}>
                  All Sections ≥60%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance</CardTitle>
            <CardDescription>
              {analytics.attendance.met ? '✓' : '❌'} {analytics.attendance.percentage !== null ? `${analytics.attendance.percentage.toFixed(1)}%` : '—'} (Need {analytics.attendance.required}%)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={analytics.attendance.percentage || 0} className="h-4" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <div className="font-semibold text-green-700">Present</div>
                <div className="text-2xl text-green-700">{analytics.attendance.presentCount}</div>
              </div>
              <div>
                <div className="font-semibold text-yellow-700">Late</div>
                <div className="text-2xl text-yellow-700">{analytics.attendance.lateCount}</div>
              </div>
              <div>
                <div className="font-semibold text-red-700">Absent</div>
                <div className="text-2xl text-red-700">{analytics.attendance.absentCount}</div>
              </div>
              <div>
                <div className="font-semibold text-blue-700">Excused</div>
                <div className="text-2xl text-blue-700">{analytics.attendance.excusedCount}</div>
              </div>
              <div>
                <div className="font-semibold text-gray-700">Total</div>
                <div className="text-2xl text-gray-700">{analytics.attendance.allLessons}</div>
              </div>
            </div>
            <p className="text-xs text-gray-500 italic">
              Formula: (Present + Late÷2) ÷ (Total - Excused) • 2 lates = 1 absence • Excused days don&apos;t count against you
            </p>
          </CardContent>
        </Card>

        {/* Exam Scores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Exam Average
              <span className="text-sm font-normal text-gray-500">
                ({analytics.exams.examsTaken}/{analytics.exams.totalApplicableExams} exams taken)
              </span>
            </CardTitle>
            <CardDescription>
              {analytics.exams.overallAverageMet ? '✓' : '❌'} {analytics.exams.overallAverage !== null ? `${analytics.exams.overallAverage.toFixed(1)}%` : '—'} (Need {analytics.exams.requiredAverage}% • Based on exams taken)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={analytics.exams.overallAverage || 0} className="h-4" />

            <div className="space-y-3">
              {analytics.exams.sectionAverages.length > 0 ? (
                analytics.exams.sectionAverages.map((sectionData) => (
                  <div key={sectionData.section} className="flex justify-between items-center">
                    <span className="text-sm">{sectionDisplayNames[sectionData.section] || sectionData.section}</span>
                    <span className={`text-sm font-medium ${sectionData.passingMet ? 'text-green-600' : 'text-red-600'}`}>
                      {sectionData.average.toFixed(1)}% {sectionData.passingMet ? '✓' : '❌'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-4">
                  No exam scores yet
                </div>
              )}
            </div>

            {/* Missing Exams */}
            {analytics.exams.missingExams && analytics.exams.missingExams.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-semibold text-amber-700 mb-2">
                  Missing Exams ({analytics.exams.missingExams.length})
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {analytics.exams.missingExams.map((exam) => (
                    <div
                      key={exam.id}
                      className="bg-amber-50 border border-amber-200 rounded p-2 flex justify-between items-center"
                    >
                      <div>
                        <div className="text-sm font-medium">{exam.sectionDisplayName}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(exam.examDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-amber-700 border-amber-400">
                        Not Taken
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
