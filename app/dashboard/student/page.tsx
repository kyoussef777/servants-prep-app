'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

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
    presentCount: number
    lateCount: number
    absentCount: number
    effectivePresent: number
    percentage: number
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
    overallAverage: number
    overallAverageMet: boolean
    allSectionsPassing: boolean
    requiredAverage: number
    requiredMinimum: number
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
  const [academicYearId, setAcademicYearId] = useState<string | null>(null)
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
        const activeYear = years.find((y: any) => y.isActive)

        if (activeYear) {
          setAcademicYearId(activeYear.id)
          setAcademicYearName(activeYear.name)

          // Fetch analytics
          const analyticsRes = await fetch(
            `/api/students/${session.user.id}/analytics?academicYearId=${activeYear.id}`
          )

          if (analyticsRes.ok) {
            const data = await analyticsRes.json()
            setAnalytics(data)
          }
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
    SPIRITUALITY_OF_MENTOR: 'Spirituality of Mentor',
    PSYCHOLOGY_METHODOLOGY: 'Psychology & Methodology',
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
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

        {/* Graduation Status */}
        <Card className={analytics.graduation.eligible ? 'border-green-500' : 'border-yellow-500'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              GRADUATION STATUS:
              {analytics.graduation.eligible ? (
                <Badge className="bg-green-500">✓ ON TRACK</Badge>
              ) : (
                <Badge className="bg-yellow-500">⚠ AT RISK</Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Attendance */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance</CardTitle>
            <CardDescription>
              {analytics.attendance.met ? '✓' : '❌'} {analytics.attendance.percentage.toFixed(1)}% (Need {analytics.attendance.required}%)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={analytics.attendance.percentage} className="h-4" />
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-semibold">Present</div>
                <div className="text-2xl">{analytics.attendance.presentCount}</div>
              </div>
              <div>
                <div className="font-semibold">Late</div>
                <div className="text-2xl">{analytics.attendance.lateCount}</div>
              </div>
              <div>
                <div className="font-semibold">Absent</div>
                <div className="text-2xl">{analytics.attendance.absentCount}</div>
              </div>
            </div>
            <p className="text-xs text-gray-500 italic">
              (2 lates = 1 absence counted)
            </p>
          </CardContent>
        </Card>

        {/* Exam Scores */}
        <Card>
          <CardHeader>
            <CardTitle>Exam Average</CardTitle>
            <CardDescription>
              {analytics.exams.overallAverageMet ? '✓' : '❌'} {analytics.exams.overallAverage.toFixed(1)}% (Need {analytics.exams.requiredAverage}%)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={analytics.exams.overallAverage} className="h-4" />

            <div className="space-y-3">
              {Object.keys(sectionDisplayNames).map((section) => {
                const sectionData = analytics.exams.sectionAverages.find(s => s.section === section)

                if (!sectionData) {
                  return (
                    <div key={section} className="flex justify-between items-center">
                      <span>{sectionDisplayNames[section]}</span>
                      <Badge variant="outline">Not taken yet</Badge>
                    </div>
                  )
                }

                return (
                  <div key={section} className="flex justify-between items-center">
                    <span>{sectionDisplayNames[section]}</span>
                    <span className={sectionData.passingMet ? 'text-green-600' : 'text-red-600'}>
                      {sectionData.average.toFixed(1)}% {sectionData.passingMet ? '✓' : `❌ (Need ${analytics.exams.requiredMinimum}%)`}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
