'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isAdmin } from "@/lib/roles"
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

export default function MenteesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [mentees, setMentees] = useState<Mentee[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMentee, setExpandedMentee] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role && !isAdmin(session.user.role)) {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    const fetchMentees = async () => {
      if (!session?.user?.id) return

      try {
        // Fetch mentees
        const menteesRes = await fetch(
          `/api/enrollments?mentorId=${session.user.id}`
        )

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
              My Mentees
            </h1>
            <p className="text-gray-600 mt-1">
              You are mentoring {mentees.length} student{mentees.length !== 1 ? 's' : ''}
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
                    <p className="text-sm text-gray-500">Total Mentees</p>
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
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/admin/students?student=${mentee.student.id}`}>
                          <CardTitle className="text-lg hover:text-blue-600 hover:underline cursor-pointer">
                            {mentee.student.name}
                          </CardTitle>
                        </Link>
                        <Badge variant="outline">
                          Year {mentee.yearLevel === 'YEAR_1' ? '1' : '2'}
                        </Badge>
                        {isAtRisk ? (
                          <Badge className="bg-red-100 text-red-800">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            At Risk
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            On Track
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1">
                        {mentee.student.email}
                        {mentee.student.phone && ` • ${mentee.student.phone}`}
                      </CardDescription>
                    </div>

                    {/* Quick Stats */}
                    {analytics && (
                      <div className="flex gap-3 md:gap-6 text-right">
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
                          <div className={`text-sm md:text-lg font-bold ${analytics.exams.missingExams?.length > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {analytics.exams.missingExams?.length || 0}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Expand/Collapse Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedMentee(isExpanded ? null : mentee.id)}
                    className="w-full justify-center text-gray-500 hover:text-gray-700"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-1" />
                        Hide Details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-1" />
                        Show Details
                      </>
                    )}
                  </Button>

                  {/* Expanded Details */}
                  {isExpanded && analytics && (
                    <div className="mt-4 space-y-6 border-t pt-4">
                      {/* Attendance Details */}
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Attendance Details
                          {analytics.attendance.met ? (
                            <Badge className="bg-green-100 text-green-800 text-xs">✓ Requirement Met</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 text-xs">Below 75%</Badge>
                          )}
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
                            <div className="text-2xl font-bold text-green-700">{analytics.attendance.presentCount}</div>
                            <div className="text-xs text-gray-600">Present</div>
                          </div>
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-center">
                            <div className="text-2xl font-bold text-yellow-700">{analytics.attendance.lateCount}</div>
                            <div className="text-xs text-gray-600">Late</div>
                          </div>
                          <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
                            <div className="text-2xl font-bold text-red-700">{analytics.attendance.absentCount}</div>
                            <div className="text-xs text-gray-600">Absent</div>
                          </div>
                          <div className="bg-gray-50 border border-gray-200 rounded p-3 text-center">
                            <div className="text-2xl font-bold text-gray-700">{analytics.attendance.excusedCount}</div>
                            <div className="text-xs text-gray-600">Excused</div>
                          </div>
                          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-center">
                            <div className="text-2xl font-bold text-blue-700">{analytics.attendance.totalLessons}</div>
                            <div className="text-xs text-gray-600">Total Lessons</div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Progress to 75% requirement</span>
                            <span className={getScoreColor(analytics.attendance.percentage)}>
                              {analytics.attendance.percentage !== null ? `${analytics.attendance.percentage.toFixed(2)}%` : '—'}
                            </span>
                          </div>
                          <Progress
                            value={analytics.attendance.percentage || 0}
                            className="h-2"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Formula: (Present + Late÷2) ÷ (Total - Excused) = {analytics.attendance.effectivePresent} ÷ {analytics.attendance.totalLessons}
                          </p>
                        </div>
                      </div>

                      {/* Exam Details */}
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2 flex-wrap">
                          <BookOpen className="h-4 w-4" />
                          Exam Performance
                          <span className="text-sm font-normal text-gray-500">
                            ({analytics.exams.examsTaken}/{analytics.exams.totalApplicableExams} taken)
                          </span>
                          {analytics.exams.overallAverageMet ? (
                            <Badge className="bg-green-100 text-green-800 text-xs">✓ Above 75%</Badge>
                          ) : analytics.exams.overallAverage !== null ? (
                            <Badge className="bg-red-100 text-red-800 text-xs">Below 75%</Badge>
                          ) : null}
                        </h4>

                        {/* Overall Average */}
                        <div className="bg-maroon-50 border border-maroon-200 rounded p-4 mb-4">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Overall Average</span>
                            <span className={`text-2xl font-bold ${getScoreColor(analytics.exams.overallAverage)}`}>
                              {analytics.exams.overallAverage !== null ? `${analytics.exams.overallAverage.toFixed(2)}%` : 'No exams yet'}
                            </span>
                          </div>
                          {analytics.exams.overallAverage !== null && (
                            <Progress
                              value={analytics.exams.overallAverage}
                              className="h-2 mt-2"
                            />
                          )}
                        </div>

                        {/* Section Breakdown */}
                        {analytics.exams.sectionAverages.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {analytics.exams.sectionAverages.map((section) => (
                              <div
                                key={section.section}
                                className={`border rounded p-3 ${
                                  section.passingMet
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-red-50 border-red-200'
                                }`}
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-sm font-medium">
                                    {SECTION_DISPLAY_NAMES[section.section] || section.section}
                                  </span>
                                  <span className={`font-bold ${section.passingMet ? 'text-green-700' : 'text-red-700'}`}>
                                    {section.average.toFixed(2)}%
                                  </span>
                                </div>
                                <Progress value={section.average} className="h-1 mb-1" />
                                <div className="flex justify-between text-xs text-gray-600">
                                  <span>{section.scores.length} exam{section.scores.length !== 1 ? 's' : ''}</span>
                                  <span>{section.passingMet ? '✓ Pass (≥60%)' : '✗ Fail (<60%)'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-center py-4">No exam scores recorded yet</p>
                        )}

                        {/* Missing Exams */}
                        {analytics.exams.missingExams && analytics.exams.missingExams.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <h5 className="font-medium text-amber-700 mb-2 flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" />
                              Missing Exams ({analytics.exams.missingExams.length})
                            </h5>
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
                      </div>

                      {/* Graduation Status */}
                      <div className="border-t pt-4">
                        <h4 className="font-semibold mb-3">Graduation Requirements</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className={`p-3 rounded border ${analytics.graduation.attendanceMet ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center gap-2">
                              {analytics.graduation.attendanceMet ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                              )}
                              <span className="font-medium">Attendance ≥75%</span>
                            </div>
                          </div>
                          <div className={`p-3 rounded border ${analytics.graduation.overallAverageMet ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center gap-2">
                              {analytics.graduation.overallAverageMet ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                              )}
                              <span className="font-medium">Exam Avg ≥75%</span>
                            </div>
                          </div>
                          <div className={`p-3 rounded border ${analytics.graduation.allSectionsPassing ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center gap-2">
                              {analytics.graduation.allSectionsPassing ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                              )}
                              <span className="font-medium">All Sections ≥60%</span>
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
                <p className="text-lg font-medium">No mentees assigned yet</p>
                <p className="text-sm mt-1">Contact an administrator to get mentees assigned to you.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
