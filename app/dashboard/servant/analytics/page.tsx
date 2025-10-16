'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Student {
  id: string
  name: string
  email: string
  enrollment: {
    id: string
    yearLevel: 'YEAR_1' | 'YEAR_2'
    isActive: boolean
    mentorId?: string
    _count?: {
      attendances: number
    }
  }
  attendances?: Array<{
    status: 'PRESENT' | 'LATE' | 'ABSENT'
  }>
  examScores?: Array<{
    score: number
    exam: {
      totalPoints: number
      section: string
    }
  }>
}

interface AnalyticsData {
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

export default function ServantAnalyticsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [analytics, setAnalytics] = useState<{ [studentId: string]: AnalyticsData }>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role !== 'SERVANT') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user?.id) {
      fetchMyMenteesAnalytics()
    }
  }, [session?.user?.id])

  const fetchMyMenteesAnalytics = async () => {
    try {
      setLoading(true)

      // Fetch all students
      const studentsRes = await fetch('/api/users?role=STUDENT')
      if (!studentsRes.ok) throw new Error('Failed to fetch students')
      const allStudents: Student[] = await studentsRes.json()

      // Filter to only my mentees
      const myMentees = allStudents.filter(s => s.enrollment?.mentorId === session?.user?.id)

      // Fetch attendance for my mentees
      const attendanceRes = await fetch('/api/attendance')
      if (!attendanceRes.ok) throw new Error('Failed to fetch attendance')
      const allAttendance = await attendanceRes.json()

      // Fetch exam scores for my mentees
      const scoresRes = await fetch('/api/exam-scores')
      if (!scoresRes.ok) throw new Error('Failed to fetch exam scores')
      const allScores = await scoresRes.json()

      // Calculate analytics for each mentee
      const analyticsMap: { [studentId: string]: AnalyticsData } = {}

      for (const student of myMentees) {
        const studentAttendance = allAttendance.filter((a: any) => a.studentId === student.id)
        const studentScores = allScores.filter((s: any) => s.studentId === student.id)

        const presentCount = studentAttendance.filter((a: any) => a.status === 'PRESENT').length
        const lateCount = studentAttendance.filter((a: any) => a.status === 'LATE').length
        const absentCount = studentAttendance.filter((a: any) => a.status === 'ABSENT').length
        const totalLessons = studentAttendance.length

        const effectivePresent = presentCount + (lateCount / 2)
        const attendancePercentage = totalLessons > 0 ? (effectivePresent / totalLessons) * 100 : 0
        const attendanceMet = attendancePercentage >= 75

        // Calculate exam averages
        const sectionAverages: { [section: string]: number } = {}
        const sections = ['BIBLE', 'DOGMA', 'CHURCH_HISTORY', 'COMPARATIVE_THEOLOGY', 'SACRAMENTS']

        for (const section of sections) {
          const sectionScores = studentScores.filter((s: any) => s.exam.section === section)
          if (sectionScores.length > 0) {
            const sectionTotal = sectionScores.reduce((sum: number, s: any) => {
              const percentage = (s.score / s.exam.totalPoints) * 100
              return sum + percentage
            }, 0)
            sectionAverages[section] = sectionTotal / sectionScores.length
          } else {
            sectionAverages[section] = 0
          }
        }

        const allSectionsMet = Object.values(sectionAverages).every(avg => avg >= 60)
        const examAverage = Object.values(sectionAverages).reduce((sum, avg) => sum + avg, 0) / 5
        const examAverageMet = examAverage >= 75

        const graduationEligible = attendanceMet && examAverageMet && allSectionsMet

        analyticsMap[student.id] = {
          attendancePercentage,
          attendanceMet,
          examAverage,
          examAverageMet,
          sectionAverages,
          allSectionsMet,
          graduationEligible,
          totalLessons,
          presentCount,
          lateCount,
          absentCount
        }
      }

      setStudents(myMentees)
      setAnalytics(analyticsMap)
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics')
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

  const getSectionName = (section: string) => {
    const names: { [key: string]: string } = {
      BIBLE: 'Bible',
      DOGMA: 'Dogma',
      CHURCH_HISTORY: 'Church History',
      COMPARATIVE_THEOLOGY: 'Comparative Theology',
      SACRAMENTS: 'Sacraments'
    }
    return names[section] || section
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Mentee Analytics</h1>
          <p className="text-gray-600 mt-1">
            Detailed progress for your assigned mentees
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {students.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-gray-500">
                You have not assigned any mentees yet. Go to{' '}
                <a href="/dashboard/servant/my-mentees" className="text-blue-600 hover:underline">
                  My Mentees
                </a>{' '}
                to assign students.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {students.map((student) => {
              const data = analytics[student.id]
              if (!data) return null

              return (
                <Card key={student.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl">{student.name}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">{student.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">
                          {student.enrollment.yearLevel === 'YEAR_1' ? 'Year 1' : 'Year 2'}
                        </Badge>
                        {data.graduationEligible ? (
                          <Badge className="bg-green-600">✓ Graduation Eligible</Badge>
                        ) : (
                          <Badge variant="destructive">✗ Not Eligible</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Attendance Section */}
                    <div>
                      <h3 className="font-semibold mb-3">Attendance</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 p-3 rounded">
                          <div className="text-2xl font-bold">
                            {data.attendancePercentage.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-600">Attendance Rate</div>
                          <div className={`text-xs mt-1 font-medium ${data.attendanceMet ? 'text-green-600' : 'text-red-600'}`}>
                            {data.attendanceMet ? '✓ Meets 75%' : '✗ Below 75%'}
                          </div>
                        </div>
                        <div className="bg-green-50 p-3 rounded">
                          <div className="text-2xl font-bold text-green-700">
                            {data.presentCount}
                          </div>
                          <div className="text-xs text-gray-600">Present</div>
                        </div>
                        <div className="bg-yellow-50 p-3 rounded">
                          <div className="text-2xl font-bold text-yellow-700">
                            {data.lateCount}
                          </div>
                          <div className="text-xs text-gray-600">Late</div>
                        </div>
                        <div className="bg-red-50 p-3 rounded">
                          <div className="text-2xl font-bold text-red-700">
                            {data.absentCount}
                          </div>
                          <div className="text-xs text-gray-600">Absent</div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Total lessons: {data.totalLessons} • 2 lates = 1 absence
                      </p>
                    </div>

                    {/* Exam Scores Section */}
                    <div>
                      <h3 className="font-semibold mb-3">Exam Performance</h3>
                      <div className="mb-4 bg-gray-50 p-3 rounded">
                        <div className="text-2xl font-bold">
                          {data.examAverage.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-600">Overall Exam Average</div>
                        <div className={`text-xs mt-1 font-medium ${data.examAverageMet ? 'text-green-600' : 'text-red-600'}`}>
                          {data.examAverageMet ? '✓ Meets 75%' : '✗ Below 75%'}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left p-2">Section</th>
                              <th className="text-center p-2">Average</th>
                              <th className="text-center p-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(data.sectionAverages).map(([section, average]) => {
                              const isPassing = average >= 60
                              return (
                                <tr key={section} className="border-b">
                                  <td className="p-2">{getSectionName(section)}</td>
                                  <td className={`p-2 text-center font-medium ${isPassing ? 'text-green-600' : 'text-red-600'}`}>
                                    {average.toFixed(1)}%
                                  </td>
                                  <td className="p-2 text-center">
                                    <Badge className={isPassing ? 'bg-green-500' : 'bg-red-500'}>
                                      {isPassing ? '✓ Pass' : '✗ Fail'}
                                    </Badge>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {data.allSectionsMet
                          ? '✓ All sections meet 60% minimum'
                          : '✗ Some sections below 60% minimum'}
                      </p>
                    </div>

                    {/* Graduation Requirements Summary */}
                    <div className="bg-gray-50 p-4 rounded">
                      <h3 className="font-semibold mb-2 text-sm">Graduation Requirements</h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={data.attendanceMet ? 'text-green-600' : 'text-red-600'}>
                            {data.attendanceMet ? '✓' : '✗'}
                          </span>
                          <span>≥75% attendance</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={data.examAverageMet ? 'text-green-600' : 'text-red-600'}>
                            {data.examAverageMet ? '✓' : '✗'}
                          </span>
                          <span>≥75% overall exam average</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={data.allSectionsMet ? 'text-green-600' : 'text-red-600'}>
                            {data.allSectionsMet ? '✓' : '✗'}
                          </span>
                          <span>≥60% in each section</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
