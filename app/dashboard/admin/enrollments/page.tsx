'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { canAssignMentors } from '@/lib/roles'
import { toast } from 'sonner'

interface Enrollment {
  id: string
  yearLevel: string
  isActive: boolean
  student: {
    id: string
    name: string
    email: string
  }
  mentor: {
    id: string
    name: string
  } | null
}

interface Servant {
  id: string
  name: string
  email: string
}

export default function EnrollmentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [servants, setServants] = useState<Servant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role && !canAssignMentors(session.user.role)) {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch enrollments
        const enrollmentsRes = await fetch('/api/enrollments')
        if (!enrollmentsRes.ok) {
          throw new Error('Failed to fetch enrollments')
        }
        const enrollmentsData = await enrollmentsRes.json()

        // Filter only active enrollments
        const activeEnrollments = Array.isArray(enrollmentsData)
          ? enrollmentsData.filter((e: any) => e.isActive)
          : []
        setEnrollments(activeEnrollments)

        // Fetch servants (all SERVANT roles - regular servants who can be assigned as mentors)
        const usersRes = await fetch('/api/users?role=SERVANT')
        if (!usersRes.ok) {
          throw new Error('Failed to fetch servants')
        }
        const servantsData = await usersRes.json()
        setServants(Array.isArray(servantsData) ? servantsData : [])
      } catch (error) {
        console.error('Failed to fetch data:', error)
        setEnrollments([])
        setServants([])
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchData()
    }
  }, [session])

  const handleMentorChange = async (enrollmentId: string, mentorId: string) => {
    try {
      const res = await fetch(`/api/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mentorId })
      })

      if (res.ok) {
        const updated = await res.json()
        setEnrollments(enrollments.map(e =>
          e.id === enrollmentId ? updated : e
        ))
        toast.success('Mentor updated successfully!')
      } else {
        const errorData = await res.json()
        toast.error(errorData.error || 'Failed to update mentor')
      }
    } catch (error) {
      console.error('Failed to update mentor:', error)
      toast.error('Failed to update mentor')
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  // Calculate workload per servant
  const servantWorkload = new Map()
  if (Array.isArray(enrollments)) {
    enrollments.forEach(enrollment => {
      if (enrollment.mentor) {
        const count = servantWorkload.get(enrollment.mentor.id) || 0
        servantWorkload.set(enrollment.mentor.id, count + 1)
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Mentor Assignments</h1>
          <p className="text-gray-600 mt-1">Assign mentors to students</p>
        </div>

        {/* Servant Workload */}
        <Card>
          <CardHeader>
            <CardTitle>Servant Workload</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {servants.map(servant => (
                <div key={servant.id} className="p-4 border rounded-lg">
                  <div className="font-medium">{servant.name}</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {servantWorkload.get(servant.id) || 0}
                  </div>
                  <div className="text-sm text-gray-600">mentees</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Enrollments */}
        <div className="space-y-3">
          {enrollments.map(enrollment => (
            <Card key={enrollment.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center gap-4">
                  <div className="flex-1">
                    <div className="font-semibold">{enrollment.student.name}</div>
                    <div className="text-sm text-gray-600">
                      {enrollment.yearLevel === 'YEAR_1' ? 'Year 1' : 'Year 2'} | {enrollment.student.email}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-600">Mentor:</div>
                    <select
                      className="h-10 px-3 rounded-md border border-input bg-background"
                      value={enrollment.mentor?.id || ''}
                      onChange={(e) => handleMentorChange(enrollment.id, e.target.value)}
                    >
                      <option value="">No mentor assigned</option>
                      {servants.map(servant => (
                        <option key={servant.id} value={servant.id}>
                          {servant.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Badge variant={enrollment.isActive ? 'default' : 'secondary'}>
                    {enrollment.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}

          {enrollments.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                No enrollments found
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
