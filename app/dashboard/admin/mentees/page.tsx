'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { isAdmin } from "@/lib/roles"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Mentee {
  id: string
  student: {
    id: string
    name: string
    email: string
  }
  yearLevel: string
  analytics?: {
    attendance: { percentage: number; met: boolean }
    exams: { overallAverage: number; overallAverageMet: boolean }
    graduation: { eligible: boolean }
  }
}

export default function MenteesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [mentees, setMentees] = useState<Mentee[]>([])
  const [loading, setLoading] = useState(true)
  const [academicYearId, setAcademicYearId] = useState<string | null>(null)

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
        // Get active academic year
        const yearsRes = await fetch('/api/academic-years')
        const years = await yearsRes.json()
        const activeYear = years.find((y: any) => y.isActive)

        if (activeYear) {
          setAcademicYearId(activeYear.id)

          // Fetch mentees
          const menteesRes = await fetch(
            `/api/enrollments?mentorId=${session.user.id}`
          )

          if (menteesRes.ok) {
            const data = await menteesRes.json()

            // Fetch analytics for each mentee
            const menteesWithAnalytics = await Promise.all(
              data.map(async (mentee: Mentee) => {
                try {
                  const analyticsRes = await fetch(
                    `/api/students/${mentee.student.id}/analytics?academicYearId=${activeYear.id}`
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">My Mentees</h1>
          <p className="text-gray-600 mt-1">
            You are mentoring {mentees.length} student{mentees.length !== 1 ? 's' : ''}
          </p>
          {atRiskMentees.length > 0 && (
            <Badge className="bg-yellow-500 mt-2">
              {atRiskMentees.length} AT RISK
            </Badge>
          )}
        </div>

        {/* Mentees List */}
        <div className="grid gap-4">
          {mentees.map((mentee) => (
            <Card key={mentee.id} className={mentee.analytics && !mentee.analytics.graduation.eligible ? 'border-yellow-500' : ''}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{mentee.student.name}</CardTitle>
                    <CardDescription>
                      Year {mentee.yearLevel === 'YEAR_1' ? '1' : '2'}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    {mentee.analytics && (
                      <>
                        <div className={mentee.analytics.attendance.met ? 'text-green-600' : 'text-red-600'}>
                          Attendance: {mentee.analytics.attendance.percentage.toFixed(1)}%{' '}
                          {mentee.analytics.attendance.met ? '✓' : '⚠️'}
                        </div>
                        <div className={mentee.analytics.exams.overallAverageMet ? 'text-green-600' : 'text-red-600'}>
                          Avg: {mentee.analytics.exams.overallAverage.toFixed(1)}%{' '}
                          {mentee.analytics.exams.overallAverageMet ? '✓' : '⚠️'}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">{mentee.student.email}</p>
                {mentee.analytics && (
                  <div className="flex gap-2">
                    {mentee.analytics.graduation.eligible ? (
                      <Badge className="bg-green-500">On Track</Badge>
                    ) : (
                      <Badge className="bg-yellow-500">At Risk</Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {mentees.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                No mentees assigned yet
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
