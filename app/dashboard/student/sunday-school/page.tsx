'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ChevronLeft, CheckCircle, XCircle, MinusCircle, Clock, KeyRound } from 'lucide-react'

const GRADE_DISPLAY: Record<string, string> = {
  PRE_K: 'Pre-K',
  KINDERGARTEN: 'Kindergarten',
  GRADE_1: '1st Grade',
  GRADE_2: '2nd Grade',
  GRADE_3: '3rd Grade',
  GRADE_4: '4th Grade',
  GRADE_5: '5th Grade',
  GRADE_6_PLUS: '6th Grade+',
}

interface SSWeek {
  weekNumber: number
  weekOf: string
  status: 'VERIFIED' | 'MANUAL' | 'EXCUSED' | 'REJECTED' | null
}

interface SSAssignment {
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
  weeks: SSWeek[]
}

interface SSProgress {
  studentId: string
  assignments: SSAssignment[]
  graduation: {
    year1Met: boolean
    year2Met: boolean
    allMet: boolean
  }
}

export default function SundaySchoolPage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()
  const [progress, setProgress] = useState<SSProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [codeDialogOpen, setCodeDialogOpen] = useState(false)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    if (!session?.user?.id) return
    try {
      const res = await fetch(`/api/sunday-school/progress?studentId=${session.user.id}`)
      if (res.ok) {
        setProgress(await res.json())
      }
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login')
    else if (authStatus === 'authenticated' && session?.user?.role !== 'STUDENT') router.push('/dashboard')
    else if (authStatus === 'authenticated' && !session?.user?.isAsyncStudent) router.push('/dashboard/student')
  }, [authStatus, session, router])

  useEffect(() => {
    if (session?.user) fetchData()
  }, [session?.user, fetchData])

  const handleSubmitCode = async () => {
    if (!code.trim()) {
      toast.error('Please enter a code')
      return
    }
    setSubmitting(true)
    try {
      const now = new Date()
      const day = now.getDay()
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - day)
      weekStart.setHours(0, 0, 0, 0)

      const res = await fetch('/api/sunday-school/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase(), weekOf: weekStart.toISOString() })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to submit code')
      }

      toast.success('Attendance logged successfully!')
      setCodeDialogOpen(false)
      setCode('')
      fetchData()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit code')
    } finally {
      setSubmitting(false)
    }
  }

  const getWeekStatusIcon = (status: SSWeek['status']) => {
    switch (status) {
      case 'VERIFIED': return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'MANUAL': return <CheckCircle className="h-5 w-5 text-blue-600" />
      case 'EXCUSED': return <MinusCircle className="h-5 w-5 text-gray-400" />
      case 'REJECTED': return <XCircle className="h-5 w-5 text-red-600" />
      default: return <Clock className="h-5 w-5 text-gray-300" />
    }
  }

  const getWeekStatusLabel = (status: SSWeek['status']) => {
    switch (status) {
      case 'VERIFIED': return 'Verified'
      case 'MANUAL': return 'Approved'
      case 'EXCUSED': return 'Excused'
      case 'REJECTED': return 'Rejected'
      default: return 'Not submitted'
    }
  }

  if (loading || authStatus === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-lg">Loading...</div></div>
  }

  const activeAssignment = progress?.assignments.find(a => a.isActive)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/student')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold dark:text-white">Sunday School</h1>
            <p className="text-gray-600 dark:text-gray-400">Track your weekly Sunday School attendance</p>
          </div>
          {activeAssignment && (
            <Button onClick={() => setCodeDialogOpen(true)} className="bg-purple-600 hover:bg-purple-700">
              <KeyRound className="h-4 w-4 mr-2" />
              Submit Code
            </Button>
          )}
        </div>

        {!progress || progress.assignments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              <p>No Sunday School assignment found. Contact your administrator.</p>
            </CardContent>
          </Card>
        ) : (
          progress.assignments.map(assignment => (
            <Card key={assignment.id} className={assignment.isActive ? 'border-purple-300' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {GRADE_DISPLAY[assignment.grade] || assignment.grade}
                    </CardTitle>
                    <CardDescription>
                      {assignment.yearLevel === 'YEAR_1' ? 'Year 1' : 'Year 2'} &bull; {assignment.academicYear.name}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    {assignment.isActive && <Badge className="bg-purple-100 text-purple-800 border-purple-300">Active</Badge>}
                    {assignment.attendance && (
                      <Badge className={`ml-2 ${assignment.attendance.met ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {assignment.attendance.percentage.toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {assignment.attendance && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {assignment.attendance.present} of {assignment.attendance.effectiveTotal} weeks attended
                      </span>
                      <span className={assignment.attendance.met ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {assignment.attendance.percentage.toFixed(0)}% {assignment.attendance.met ? '(Met)' : '(Need 75%)'}
                      </span>
                    </div>
                    <Progress value={assignment.attendance.percentage} className="h-3" />
                  </div>
                )}

                {/* Week-by-week tracker */}
                <div className="space-y-2">
                  {assignment.weeks.map(week => (
                    <div key={week.weekNumber} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded">
                      <div className="flex items-center gap-3">
                        {getWeekStatusIcon(week.status)}
                        <div>
                          <span className="text-sm font-medium">Week {week.weekNumber}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            {new Date(week.weekOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      <span className={`text-xs font-medium ${
                        week.status === 'VERIFIED' || week.status === 'MANUAL' ? 'text-green-600' :
                        week.status === 'EXCUSED' ? 'text-gray-500' :
                        week.status === 'REJECTED' ? 'text-red-600' : 'text-gray-400'
                      }`}>
                        {getWeekStatusLabel(week.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {/* Code Submit Dialog */}
        <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Submit Attendance Code</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter the verification code provided by your Sunday School servant.
              </p>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g., G2-A7X3"
                className="text-center text-lg font-mono tracking-wider"
                maxLength={10}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCodeDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSubmitCode}
                disabled={submitting || !code.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {submitting ? 'Verifying...' : 'Submit'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
