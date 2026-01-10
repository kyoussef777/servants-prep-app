'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Users,
  AlertTriangle,
  CheckCircle,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react'

interface SectionAverage {
  section: string
  average: number
  scores: number[]
  passingMet: boolean
}

interface MissingExam {
  id: string
  examDate: string
  totalPoints: number
  yearLevel: string
  sectionName: string
  sectionDisplayName: string
}

interface Mentee {
  id: string
  student: {
    id: string
    name: string
    email: string
    phone?: string
  }
  yearLevel: string
  status: string
  analytics?: {
    enrollment: {
      yearLevel: string
      status: string
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
      sectionAverages: SectionAverage[]
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
}

const SECTION_DISPLAY_NAMES: { [key: string]: string } = {
  'BIBLE_STUDIES': 'Bible Studies',
  'DOGMA': 'Dogma',
  'COMPARATIVE_THEOLOGY': 'Comparative Theology',
  'RITUAL_THEOLOGY': 'Ritual & Sacraments',
  'CHURCH_HISTORY': 'Church History',
  'SPIRITUALITY': 'Spirituality',
  'PSYCHOLOGY_METHODOLOGY': 'Psychology & Methodology',
  'MISCELLANEOUS': 'Miscellaneous'
}

export default function MyMenteesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [mentees, setMentees] = useState<Mentee[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMentee, setExpandedMentee] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role &&
               session.user.role !== 'MENTOR' &&
               session.user.role !== 'SUPER_ADMIN' &&
               session.user.role !== 'PRIEST' &&
               session.user.role !== 'SERVANT_PREP') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    const fetchMentees = async () => {
      if (!session?.user?.id) return

      try {
        // PRIEST role sees ALL students; others see only their assigned mentees
        const isPriest = session?.user?.role === 'PRIEST'
        const url = isPriest
          ? '/api/enrollments'
          : `/api/enrollments?mentorId=${session.user.id}`

        const menteesRes = await fetch(url)

        if (menteesRes.ok) {
          const data = await menteesRes.json()

          // Fetch analytics for each mentee (no academicYearId filter - aggregate across ALL years)
          const menteesWithAnalytics = await Promise.all(
            data.map(async (mentee: Mentee) => {
              try {
                const analyticsRes = await fetch(
                  `/api/students/${mentee.student.id}/analytics`
                )

                if (analyticsRes.ok) {
                  const analytics = await analyticsRes.json()
                  return { ...mentee, analytics }
                }
              } catch (error) {
                console.error('Failed to fetch analytics for mentee:', error)
              }
              return mentee
            })
          )

          setMentees(menteesWithAnalytics.filter(m => m.student))
        }
      } catch (error) {
        console.error('Failed to fetch mentees:', error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchMentees()
    }
  }, [session])

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const isPriest = session?.user?.role === 'PRIEST'
  const atRiskMentees = mentees.filter(m => m.analytics && !m.analytics.graduation.eligible)
  const onTrackMentees = mentees.filter(m => m.analytics && m.analytics.graduation.eligible)
  const totalMentees = mentees.length

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-500'
    if (score >= 75) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              {isPriest ? 'All Students' : 'My Mentees'}
            </h1>
            <p className="text-gray-600 mt-1">
              {isPriest
                ? `Viewing all ${mentees.length} enrolled student${mentees.length !== 1 ? 's' : ''}`
                : `You are mentoring ${mentees.length} student${mentees.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex gap-2">
            {atRiskMentees.length > 0 && (
              <Badge className="bg-red-500 text-white px-3 py-1">
                <AlertTriangle className="h-4 w-4 mr-1" />
                {atRiskMentees.length} At Risk
              </Badge>
            )}
            {onTrackMentees.length > 0 && (
              <Badge className="bg-green-500 text-white px-3 py-1">
                <CheckCircle className="h-4 w-4 mr-1" />
                {onTrackMentees.length} On Track
              </Badge>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        {mentees.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{isPriest ? 'Total Students' : 'Total Mentees'}</p>
                    <p className="text-3xl font-bold">{totalMentees}</p>
                  </div>
                  <Users className="h-10 w-10 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">On Track</p>
                    <p className="text-3xl font-bold text-green-600">{onTrackMentees.length}</p>
                  </div>
                  <CheckCircle className="h-10 w-10 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">At Risk</p>
                    <p className="text-3xl font-bold text-red-600">{atRiskMentees.length}</p>
                  </div>
                  <AlertTriangle className="h-10 w-10 text-red-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Mentees List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Student Details</h2>

          {mentees.map((mentee) => {
            const isExpanded = expandedMentee === mentee.id
            const analytics = mentee.analytics
            const isAtRisk = analytics && !analytics.graduation.eligible

            return (
              <Card
                key={mentee.id}
                className={`transition-all ${isAtRisk ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-green-500'}`}
              >
                <CardHeader className="pb-2 px-3 md:px-6">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                        <Link href={`/dashboard/admin/students?student=${mentee.student.id}`}>
                          <CardTitle className="text-base md:text-lg truncate hover:text-blue-600 hover:underline cursor-pointer">
                            {mentee.student.name}
                          </CardTitle>
                        </Link>
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          Year {mentee.yearLevel === 'YEAR_1' ? '1' : '2'}
                        </Badge>
                        {isAtRisk ? (
                          <Badge className="bg-red-100 text-red-800 text-xs px-1.5 py-0">
                            <AlertTriangle className="h-3 w-3 mr-0.5" />
                            At Risk
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 text-xs px-1.5 py-0">
                            <CheckCircle className="h-3 w-3 mr-0.5" />
                            On Track
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1 text-xs md:text-sm truncate">
                        {mentee.student.email}
                        {mentee.student.phone && <span className="hidden md:inline"> • {mentee.student.phone}</span>}
                      </CardDescription>
                    </div>

                    {/* Quick Stats - horizontal on mobile */}
                    {analytics && (
                      <div className="flex gap-4 md:gap-6 text-left md:text-right">
                        <div>
                          <div className="text-[10px] md:text-xs text-gray-500 uppercase">Attendance</div>
                          <div className={`text-sm md:text-lg font-bold ${getScoreColor(analytics.attendance.percentage)}`}>
                            {analytics.attendance.percentage !== null ? `${analytics.attendance.percentage.toFixed(1)}%` : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] md:text-xs text-gray-500 uppercase">Exam Avg</div>
                          <div className={`text-sm md:text-lg font-bold ${getScoreColor(analytics.exams.overallAverage)}`}>
                            {analytics.exams.overallAverage !== null ? `${analytics.exams.overallAverage.toFixed(1)}%` : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] md:text-xs text-gray-500 uppercase">Missing</div>
                          <div className={`text-sm md:text-lg font-bold ${analytics.exams.missingExams?.length > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                            {analytics.exams.missingExams?.length || 0}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-0 px-3 md:px-6">
                  {/* Expand/Collapse Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedMentee(isExpanded ? null : mentee.id)}
                    className="w-full justify-center text-gray-500 hover:text-gray-700 text-xs md:text-sm"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                        Hide Details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                        Show Details
                      </>
                    )}
                  </Button>

                  {/* Expanded Details */}
                  {isExpanded && analytics && (
                    <div className="mt-3 md:mt-4 space-y-4 md:space-y-6 border-t pt-3 md:pt-4">
                      {/* Attendance Details */}
                      <div>
                        <h4 className="font-semibold mb-2 md:mb-3 flex flex-wrap items-center gap-1.5 md:gap-2 text-sm md:text-base">
                          <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          Attendance
                          {analytics.attendance.met ? (
                            <Badge className="bg-green-100 text-green-800 text-[10px] md:text-xs px-1.5 py-0">✓ Met</Badge>
                          ) : analytics.attendance.percentage !== null ? (
                            <Badge className="bg-red-100 text-red-800 text-[10px] md:text-xs px-1.5 py-0">Below 75%</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800 text-[10px] md:text-xs px-1.5 py-0">No data</Badge>
                          )}
                        </h4>
                        <div className="grid grid-cols-5 gap-1.5 md:gap-3">
                          <div className="bg-green-50 border border-green-200 rounded p-1.5 md:p-3 text-center">
                            <div className="text-base md:text-2xl font-bold text-green-700">{analytics.attendance.presentCount}</div>
                            <div className="text-[9px] md:text-xs text-gray-600">Present</div>
                          </div>
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-1.5 md:p-3 text-center">
                            <div className="text-base md:text-2xl font-bold text-yellow-700">{analytics.attendance.lateCount}</div>
                            <div className="text-[9px] md:text-xs text-gray-600">Late</div>
                          </div>
                          <div className="bg-red-50 border border-red-200 rounded p-1.5 md:p-3 text-center">
                            <div className="text-base md:text-2xl font-bold text-red-700">{analytics.attendance.absentCount}</div>
                            <div className="text-[9px] md:text-xs text-gray-600">Absent</div>
                          </div>
                          <div className="bg-gray-50 border border-gray-200 rounded p-1.5 md:p-3 text-center">
                            <div className="text-base md:text-2xl font-bold text-gray-700">{analytics.attendance.excusedCount}</div>
                            <div className="text-[9px] md:text-xs text-gray-600">Excused</div>
                          </div>
                          <div className="bg-blue-50 border border-blue-200 rounded p-1.5 md:p-3 text-center">
                            <div className="text-base md:text-2xl font-bold text-blue-700">{analytics.attendance.totalLessons}</div>
                            <div className="text-[9px] md:text-xs text-gray-600">Total</div>
                          </div>
                        </div>
                        <div className="mt-2 md:mt-3">
                          <div className="flex justify-between text-xs md:text-sm mb-1">
                            <span>Progress to 75%</span>
                            <span className={getScoreColor(analytics.attendance.percentage)}>
                              {analytics.attendance.percentage !== null ? `${analytics.attendance.percentage.toFixed(1)}%` : '—'}
                            </span>
                          </div>
                          <Progress
                            value={analytics.attendance.percentage || 0}
                            className="h-1.5 md:h-2"
                          />
                          <p className="text-[10px] md:text-xs text-gray-500 mt-1">
                            (Present + Late÷2) ÷ (Total - Excused) = {analytics.attendance.effectivePresent.toFixed(1)} ÷ {analytics.attendance.totalLessons}
                          </p>
                        </div>
                      </div>

                      {/* Exam Details */}
                      <div>
                        <h4 className="font-semibold mb-2 md:mb-3 flex flex-wrap items-center gap-1.5 md:gap-2 text-sm md:text-base">
                          <BookOpen className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          Exams
                          <span className="text-[10px] md:text-xs font-normal text-gray-500">
                            ({analytics.exams.examsTaken}/{analytics.exams.totalApplicableExams} taken)
                          </span>
                          {analytics.exams.overallAverageMet ? (
                            <Badge className="bg-green-100 text-green-800 text-[10px] md:text-xs px-1.5 py-0">✓ Above 75%</Badge>
                          ) : analytics.exams.overallAverage !== null ? (
                            <Badge className="bg-red-100 text-red-800 text-[10px] md:text-xs px-1.5 py-0">Below 75%</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800 text-[10px] md:text-xs px-1.5 py-0">No exams</Badge>
                          )}
                        </h4>

                        {/* Overall Average */}
                        <div className="bg-maroon-50 border border-maroon-200 rounded p-2.5 md:p-4 mb-3 md:mb-4">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-xs md:text-base">Overall Average</span>
                            <span className={`text-lg md:text-2xl font-bold ${getScoreColor(analytics.exams.overallAverage)}`}>
                              {analytics.exams.overallAverage !== null ? `${analytics.exams.overallAverage.toFixed(1)}%` : '—'}
                            </span>
                          </div>
                          {analytics.exams.overallAverage !== null && (
                            <Progress
                              value={analytics.exams.overallAverage}
                              className="h-1.5 md:h-2 mt-2"
                            />
                          )}
                        </div>

                        {/* Section Breakdown */}
                        {analytics.exams.sectionAverages.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                            {analytics.exams.sectionAverages.map((section) => (
                              <div
                                key={section.section}
                                className={`border rounded p-2 md:p-3 ${
                                  section.passingMet
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-red-50 border-red-200'
                                }`}
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs md:text-sm font-medium truncate mr-2">
                                    {SECTION_DISPLAY_NAMES[section.section] || section.section}
                                  </span>
                                  <span className={`font-bold text-sm md:text-base ${section.passingMet ? 'text-green-700' : 'text-red-700'}`}>
                                    {section.average.toFixed(1)}%
                                  </span>
                                </div>
                                <Progress value={section.average} className="h-1 mb-1" />
                                <div className="flex justify-between text-[10px] md:text-xs text-gray-600">
                                  <span>{section.scores.length} exam{section.scores.length !== 1 ? 's' : ''}</span>
                                  <span>{section.passingMet ? '✓ ≥60%' : '✗ <60%'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-center py-3 text-xs md:text-sm">No exam scores recorded yet</p>
                        )}

                        {/* Missing Exams */}
                        {analytics.exams.missingExams && analytics.exams.missingExams.length > 0 && (
                          <div className="mt-3 md:mt-4">
                            <h5 className="font-medium text-amber-700 mb-2 flex items-center gap-1.5 text-xs md:text-sm">
                              <AlertCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
                              Missing Exams ({analytics.exams.missingExams.length})
                            </h5>
                            <div className="space-y-1.5 md:space-y-2 max-h-40 overflow-y-auto">
                              {analytics.exams.missingExams.map((exam) => (
                                <div
                                  key={exam.id}
                                  className="bg-amber-50 border border-amber-200 rounded p-2 md:p-2.5 flex justify-between items-center"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs md:text-sm font-medium truncate">
                                      {exam.sectionDisplayName}
                                    </div>
                                    <div className="text-[10px] md:text-xs text-gray-500">
                                      {new Date(exam.examDate).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                      })}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-amber-700 border-amber-400 text-[10px] md:text-xs px-1.5 py-0 ml-2 shrink-0">
                                    Not Taken
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Graduation Status */}
                      <div className="border-t pt-3 md:pt-4">
                        <h4 className="font-semibold mb-2 md:mb-3 text-sm md:text-base">Graduation Requirements</h4>
                        <div className="grid grid-cols-3 gap-1.5 md:gap-3">
                          <div className={`p-2 md:p-3 rounded border ${analytics.graduation.attendanceMet ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex flex-col md:flex-row items-center gap-1 md:gap-2">
                              {analytics.graduation.attendanceMet ? (
                                <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-600 shrink-0" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-red-600 shrink-0" />
                              )}
                              <span className="font-medium text-[10px] md:text-sm text-center">Attendance ≥75%</span>
                            </div>
                          </div>
                          <div className={`p-2 md:p-3 rounded border ${analytics.graduation.overallAverageMet ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex flex-col md:flex-row items-center gap-1 md:gap-2">
                              {analytics.graduation.overallAverageMet ? (
                                <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-600 shrink-0" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-red-600 shrink-0" />
                              )}
                              <span className="font-medium text-[10px] md:text-sm text-center">Exam Avg ≥75%</span>
                            </div>
                          </div>
                          <div className={`p-2 md:p-3 rounded border ${analytics.graduation.allSectionsPassing ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex flex-col md:flex-row items-center gap-1 md:gap-2">
                              {analytics.graduation.allSectionsPassing ? (
                                <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-600 shrink-0" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-red-600 shrink-0" />
                              )}
                              <span className="font-medium text-[10px] md:text-sm text-center">Sections ≥60%</span>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}

          {mentees.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  {isPriest ? 'No students enrolled' : 'No mentees assigned yet'}
                </p>
                <p className="text-sm mt-1">
                  {isPriest
                    ? 'No students are currently enrolled in the program.'
                    : 'Contact an administrator to get mentees assigned to you.'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
