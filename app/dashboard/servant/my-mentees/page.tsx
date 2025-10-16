'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface Student {
  id: string
  name: string
  email: string
  enrollment?: {
    id: string
    yearLevel: 'YEAR_1' | 'YEAR_2'
    mentorId: string | null
  } | null
}

export default function MyMenteesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [myMentees, setMyMentees] = useState<Student[]>([])
  const [availableStudents, setAvailableStudents] = useState<Student[]>([])
  const [searchTerm, setSearchTerm] = useState('')
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
      fetchStudents()
    }
  }, [session?.user?.id])

  const fetchStudents = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/users?role=STUDENT')
      if (!res.ok) throw new Error('Failed to fetch students')

      const students: Student[] = await res.json()

      // Separate students into my mentees vs available
      const mentees = students.filter(s => s.enrollment?.mentorId === session?.user?.id)
      const available = students.filter(s => !s.enrollment?.mentorId || s.enrollment?.mentorId !== session?.user?.id)

      setMyMentees(mentees)
      setAvailableStudents(available)
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async (studentId: string) => {
    try {
      const res = await fetch('/api/enrollments/self-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to assign mentee')
      }

      await fetchStudents()
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to assign mentee')
    }
  }

  const handleUnassign = async (studentId: string) => {
    try {
      const res = await fetch('/api/enrollments/unassign-mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to unassign mentee')
      }

      await fetchStudents()
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to unassign mentee')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const filteredAvailable = availableStudents.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const menteeCount = myMentees.length
  const canAssignMore = menteeCount < 3

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">My Mentees</h1>
          <p className="text-gray-600 mt-1">
            Manage your assigned students ({menteeCount} / 3)
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
              Current Mentees ({menteeCount} / 3)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myMentees.length === 0 ? (
              <p className="text-gray-500 text-sm">
                You have not assigned any mentees yet. Assign up to 3 students below.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-2 w-8">#</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-center p-2 w-20">Year</th>
                      <th className="text-center p-2 w-32">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myMentees.map((student, index) => (
                      <tr key={student.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 text-gray-500">{index + 1}</td>
                        <td className="p-2 font-medium">{student.name}</td>
                        <td className="p-2 text-gray-600">{student.email}</td>
                        <td className="p-2 text-center">
                          <Badge variant="outline">
                            {student.enrollment?.yearLevel === 'YEAR_1' ? 'Y1' : 'Y2'}
                          </Badge>
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleUnassign(student.id)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Students */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle>Available Students</CardTitle>
              <Input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="md:w-64"
              />
            </div>
          </CardHeader>
          <CardContent>
            {!canAssignMore && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-4">
                You have reached the maximum of 3 mentees. Remove a mentee to assign a new one.
              </div>
            )}

            {filteredAvailable.length === 0 ? (
              <p className="text-gray-500 text-sm">
                {searchTerm ? 'No students match your search.' : 'No available students.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-2 w-8">#</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-center p-2 w-20">Year</th>
                      <th className="text-left p-2 w-32">Current Mentor</th>
                      <th className="text-center p-2 w-32">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAvailable.map((student, index) => {
                      const hasOtherMentor = !!(student.enrollment?.mentorId && student.enrollment.mentorId !== session?.user?.id)

                      return (
                        <tr key={student.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-gray-500">{index + 1}</td>
                          <td className="p-2 font-medium">{student.name}</td>
                          <td className="p-2 text-gray-600">{student.email}</td>
                          <td className="p-2 text-center">
                            {student.enrollment ? (
                              <Badge variant="outline">
                                {student.enrollment.yearLevel === 'YEAR_1' ? 'Y1' : 'Y2'}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 text-xs">Not enrolled</span>
                            )}
                          </td>
                          <td className="p-2">
                            {hasOtherMentor ? (
                              <Badge variant="secondary" className="text-xs">Assigned</Badge>
                            ) : (
                              <span className="text-gray-400 text-xs">None</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <Button
                              size="sm"
                              onClick={() => handleAssign(student.id)}
                              disabled={!canAssignMore || hasOtherMentor}
                            >
                              Assign to Me
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
