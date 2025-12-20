'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Enrollment {
  id: string
  yearLevel: 'YEAR_1' | 'YEAR_2'
  student: {
    id: string
    name: string
    email: string
  }
}

export default function MyMenteesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [myMentees, setMyMentees] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role !== 'MENTOR') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user?.id) {
      fetchStudents()
    }
  }, [session?.user?.id])

  const fetchStudents = async () => {
    try {
      setLoading(true)
      // Fetch only enrollments where this mentor is assigned
      const res = await fetch(`/api/enrollments?mentorId=${session?.user?.id}`)
      if (!res.ok) throw new Error('Failed to fetch mentees')

      const enrollments: Enrollment[] = await res.json()
      setMyMentees(enrollments)
      setError('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load mentees')
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

  const menteeCount = myMentees.length

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">My Mentees</h1>
          <p className="text-gray-600 mt-1">
            View your assigned students ({menteeCount} total)
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Current Mentees */}
        <Card>
          <CardHeader>
            <CardTitle>
              Your Assigned Mentees ({menteeCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myMentees.length === 0 ? (
              <p className="text-gray-500 text-sm">
                You do not have any mentees assigned to you yet. Contact an administrator to get students assigned.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-2 w-8">#</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-center p-2 w-24">Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myMentees.map((enrollment, index) => (
                      <tr key={enrollment.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 text-gray-500">{index + 1}</td>
                        <td className="p-2 font-medium">{enrollment.student.name}</td>
                        <td className="p-2 text-gray-600">{enrollment.student.email}</td>
                        <td className="p-2 text-center">
                          <Badge variant="outline">
                            {enrollment.yearLevel === 'YEAR_1' ? 'Year 1' : 'Year 2'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-700">
              <strong>Note:</strong> You have read-only access to view your assigned mentees' attendance, grades, and analytics.
              To request changes to your mentee assignments, please contact an administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
