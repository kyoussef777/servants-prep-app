'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminGuard } from '@/hooks/useAdminGuard'
import { isStudent } from '@/lib/roles'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DashboardSkeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/admin/page-header'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { SECTION_DISPLAY_NAMES } from '@/lib/constants'
import type { AttendanceAnalytics, ExamAnalytics, GraduationStatus } from '@/lib/types'
import { getAttendanceGuidance, getExamGuidance } from '@/lib/graduation-guidance'
import { Phone, Mail, Church, Lightbulb, BookOpen, FileText, GraduationCap as GradCap } from 'lucide-react'

interface Analytics {
  enrollment: {
    id: string
    yearLevel: 'YEAR_1' | 'YEAR_2'
    isActive: boolean
    isAsyncStudent: boolean
    status: string
    mentor: {
      id: string
      name: string
      email: string
      phone: string | null
    } | null
    fatherOfConfession: {
      id: string
      name: string
      phone: string | null
      church: string | null
    } | null
    student: {
      id: string
      name: string
      email: string
    }
  }
  attendance: AttendanceAnalytics
  exams: ExamAnalytics
  graduation: GraduationStatus
  asyncNotes?: {
    total: number
    pending: number
    approved: number
    rejected: number
  }
  sundaySchool?: {
    assignments: Array<{
      id: string
      grade: string
      yearLevel: string
      academicYear: { id: string; name: string }
      totalWeeks: number
      startDate: string
      isActive: boolean
      attendance: {
        present: number
        excused: number
        absent: number
        effectiveTotal: number
        percentage: number
        met: boolean
      } | null
    }>
    year1Met: boolean
    year2Met: boolean
    allMet: boolean
  }
}

export default function StudentDashboard() {
  const { session, status } = useAdminGuard(isStudent)
  const router = useRouter()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [, setAcademicYearId] = useState<string | null>(null)
  const [academicYearName, setAcademicYearName] = useState<string>('')

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
    return <DashboardSkeleton />
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


  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          title={`Welcome, ${session?.user?.name}`}
          description={[
            `Year ${analytics.enrollment.yearLevel === 'YEAR_1' ? '1' : '2'} Student${academicYearName ? ` - ${academicYearName}` : ''}`,
            analytics.enrollment.mentor ? `Mentor: ${analytics.enrollment.mentor.name}` : '',
          ].filter(Boolean).join(' · ')}
          actions={
            <>
              <Button onClick={() => router.push('/dashboard/student/lessons')} size="sm" className="gap-2">
                <BookOpen className="h-4 w-4" />
                My Lessons
              </Button>
              {analytics.enrollment.isAsyncStudent && (
                <>
                  <Button
                    onClick={() => router.push('/dashboard/student/async-notes')}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    My Notes
                  </Button>
                  <Button
                    onClick={() => router.push('/dashboard/student/sunday-school')}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                  >
                    <GradCap className="h-4 w-4" />
                    Sunday School
                  </Button>
                </>
              )}
            </>
          }
        />

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
            <div className={`grid gap-3 ${analytics.enrollment.isAsyncStudent ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
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
              {analytics.enrollment.isAsyncStudent && analytics.graduation.sundaySchoolMet !== undefined && (
                <div className={`p-3 rounded border text-center ${analytics.graduation.sundaySchoolMet ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="text-2xl mb-1">{analytics.graduation.sundaySchoolMet ? '✓' : '✗'}</div>
                  <div className={`text-sm font-medium ${analytics.graduation.sundaySchoolMet ? 'text-green-700' : 'text-red-700'}`}>
                    Sunday School ≥75%
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actionable Guidance */}
        {(() => {
          const att = getAttendanceGuidance(analytics.attendance)
          const ex = getExamGuidance(analytics.exams)
          const items: Array<{ label: string; status: string; message: string; detail?: string }> = [
            { label: 'Attendance', status: att.status, message: att.message, detail: att.detail },
            { label: 'Exam Average', status: ex.status, message: ex.message, detail: ex.detail },
          ]
          const tone = (s: string) =>
            s === 'failing' ? 'bg-red-50 border-red-200 text-red-900'
            : s === 'at-risk' ? 'bg-yellow-50 border-yellow-200 text-yellow-900'
            : s === 'on-track' ? 'bg-green-50 border-green-200 text-green-900'
            : 'bg-gray-50 border-gray-200 text-gray-700'

          return (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  What to do next
                </CardTitle>
                <CardDescription>Personalized guidance based on your current progress</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {items.map(item => (
                  <div key={item.label} className={`p-3 rounded-md border text-sm ${tone(item.status)}`}>
                    <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{item.label}</div>
                    <div className="font-medium mt-1">{item.message}</div>
                    {item.detail && <div className="text-xs mt-1 opacity-80">{item.detail}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })()}

        {/* Contacts */}
        {(analytics.enrollment.mentor || analytics.enrollment.fatherOfConfession) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {analytics.enrollment.mentor && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Mentor</CardTitle>
                  <CardDescription>{analytics.enrollment.mentor.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {analytics.enrollment.mentor.email && (
                    <a href={`mailto:${analytics.enrollment.mentor.email}`} className="flex items-center gap-2 text-gray-600 hover:text-blue-600">
                      <Mail className="h-4 w-4 shrink-0" />
                      {analytics.enrollment.mentor.email}
                    </a>
                  )}
                  {analytics.enrollment.mentor.phone && (
                    <a href={`tel:${analytics.enrollment.mentor.phone}`} className="flex items-center gap-2 text-gray-600 hover:text-blue-600">
                      <Phone className="h-4 w-4 shrink-0" />
                      {analytics.enrollment.mentor.phone}
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
            {analytics.enrollment.fatherOfConfession && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Father of Confession</CardTitle>
                  <CardDescription>{analytics.enrollment.fatherOfConfession.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {analytics.enrollment.fatherOfConfession.church && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Church className="h-4 w-4 shrink-0" />
                      {analytics.enrollment.fatherOfConfession.church}
                    </div>
                  )}
                  {analytics.enrollment.fatherOfConfession.phone && (
                    <a href={`tel:${analytics.enrollment.fatherOfConfession.phone}`} className="flex items-center gap-2 text-gray-600 hover:text-blue-600">
                      <Phone className="h-4 w-4 shrink-0" />
                      {analytics.enrollment.fatherOfConfession.phone}
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Async Student Progress */}
        {analytics.enrollment.isAsyncStudent && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lesson Notes Summary */}
            {analytics.asyncNotes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Lesson Notes</CardTitle>
                  <CardDescription>Your note submissions for lessons</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 bg-green-50 rounded border border-green-200">
                      <div className="text-2xl font-bold text-green-700">{analytics.asyncNotes.approved}</div>
                      <div className="text-xs text-green-600">Approved</div>
                    </div>
                    <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                      <div className="text-2xl font-bold text-yellow-700">{analytics.asyncNotes.pending}</div>
                      <div className="text-xs text-yellow-600">Pending</div>
                    </div>
                    <div className="p-2 bg-red-50 rounded border border-red-200">
                      <div className="text-2xl font-bold text-red-700">{analytics.asyncNotes.rejected}</div>
                      <div className="text-xs text-red-600">Rejected</div>
                    </div>
                  </div>
                  <Button
                    onClick={() => router.push('/dashboard/student/async-notes')}
                    variant="ghost"
                    size="sm"
                    className="mt-3 w-full"
                  >
                    View All Notes →
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Sunday School Summary */}
            {analytics.sundaySchool && analytics.sundaySchool.assignments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Sunday School</CardTitle>
                  <CardDescription>
                    {analytics.sundaySchool.assignments[0]?.grade?.replace('_', ' ').replace('GRADE ', 'Grade ').replace('PRE K', 'Pre-K').replace('KINDERGARTEN', 'Kindergarten').replace('GRADE 6 PLUS', '6th Grade+')}
                    {' '}&bull; {analytics.sundaySchool.assignments[0]?.yearLevel === 'YEAR_1' ? 'Year 1' : 'Year 2'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.sundaySchool.assignments.map(assignment => (
                    <div key={assignment.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Attendance</span>
                        <span className={`text-sm font-bold ${assignment.attendance?.met ? 'text-green-600' : 'text-red-600'}`}>
                          {assignment.attendance ? `${assignment.attendance.percentage.toFixed(0)}%` : 'N/A'}
                        </span>
                      </div>
                      {assignment.attendance && (
                        <Progress value={assignment.attendance.percentage} className="h-3" />
                      )}
                      <div className="text-xs text-gray-500">
                        {assignment.attendance?.present ?? 0} of {assignment.attendance?.effectiveTotal ?? assignment.totalWeeks} weeks attended (75% required)
                      </div>
                    </div>
                  ))}
                  <Button
                    onClick={() => router.push('/dashboard/student/sunday-school')}
                    variant="ghost"
                    size="sm"
                    className="mt-3 w-full"
                  >
                    View Details →
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

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
            <div className={`grid grid-cols-2 gap-4 text-sm ${(analytics.attendance.notEnrolledYetCount ?? 0) > 0 ? 'md:grid-cols-6' : 'md:grid-cols-5'}`}>
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
                <div className="text-2xl text-blue-700">{analytics.attendance.excusedCount - (analytics.attendance.notEnrolledYetCount ?? 0)}</div>
              </div>
              {(analytics.attendance.notEnrolledYetCount ?? 0) > 0 && (
                <div>
                  <div className="font-semibold text-gray-500">N/A (Late start)</div>
                  <div className="text-2xl text-gray-500">{analytics.attendance.notEnrolledYetCount}</div>
                </div>
              )}
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
                    <span className="text-sm">{SECTION_DISPLAY_NAMES[sectionData.section] || sectionData.section}</span>
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
