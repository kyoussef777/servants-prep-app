'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { canAssignMentors } from '@/lib/roles'
import { toast } from 'sonner'

interface AcademicYear {
  id: string
  name: string
}

interface Enrollment {
  id: string
  yearLevel: string
  isActive: boolean
  status: 'ACTIVE' | 'GRADUATED' | 'WITHDRAWN'
  student: {
    id: string
    name: string
    email: string
  }
  mentor: {
    id: string
    name: string
  } | null
  academicYear: AcademicYear | null
  graduatedAcademicYear: AcademicYear | null
}

interface Mentor {
  id: string
  name: string
  email: string
}

export default function EnrollmentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMentor, setFilterMentor] = useState<string>('all')
  const [filterYear, setFilterYear] = useState<string>('all')
  const [filterAcademicYear, setFilterAcademicYear] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('ACTIVE')

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
        // Fetch all data in parallel
        const [enrollmentsRes, usersRes, yearsRes] = await Promise.all([
          fetch('/api/enrollments'),
          fetch('/api/users'),
          fetch('/api/academic-years')
        ])

        if (!enrollmentsRes.ok) throw new Error('Failed to fetch enrollments')
        if (!usersRes.ok) throw new Error('Failed to fetch users')
        if (!yearsRes.ok) throw new Error('Failed to fetch academic years')

        const [enrollmentsData, usersData, yearsData] = await Promise.all([
          enrollmentsRes.json(),
          usersRes.json(),
          yearsRes.json()
        ])

        // Set all enrollments (filtering is done in UI)
        setEnrollments(Array.isArray(enrollmentsData) ? enrollmentsData : [])

        // Set academic years
        setAcademicYears(Array.isArray(yearsData) ? yearsData : [])

        // Filter to only users who can be mentors
        const mentorsData = Array.isArray(usersData)
          ? usersData.filter((user: any) =>
              user.role === 'SUPER_ADMIN' ||
              user.role === 'SERVANT_PREP' ||
              user.role === 'MENTOR'
            )
          : []
        setMentors(mentorsData)
      } catch (error) {
        console.error('Failed to fetch data:', error)
        setEnrollments([])
        setMentors([])
        setAcademicYears([])
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

  // Filter enrollments
  const filteredEnrollments = enrollments.filter(enrollment => {
    if (searchTerm && !enrollment.student.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !enrollment.student.email.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    if (filterMentor !== 'all') {
      if (filterMentor === 'unassigned' && enrollment.mentor) return false
      if (filterMentor !== 'unassigned' && enrollment.mentor?.id !== filterMentor) return false
    }
    if (filterYear !== 'all' && enrollment.yearLevel !== filterYear) {
      return false
    }
    if (filterStatus !== 'all' && enrollment.status !== filterStatus) {
      return false
    }
    if (filterAcademicYear !== 'all') {
      // For graduated students, check graduatedAcademicYear; for others, check academicYear
      if (filterStatus === 'GRADUATED') {
        if (enrollment.graduatedAcademicYear?.id !== filterAcademicYear) return false
      } else {
        if (enrollment.academicYear?.id !== filterAcademicYear) return false
      }
    }
    return true
  })

  // Calculate workload per mentor
  const mentorWorkload = new Map()
  if (Array.isArray(enrollments)) {
    enrollments.forEach(enrollment => {
      if (enrollment.mentor) {
        const count = mentorWorkload.get(enrollment.mentor.id) || 0
        mentorWorkload.set(enrollment.mentor.id, count + 1)
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Mentor Assignments</h1>
          <p className="text-gray-600 mt-1">Assign mentors to students ({filteredEnrollments.length} students)</p>
        </div>

        {/* Mentor Workload Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Mentor Workload</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {mentors.map(mentor => (
                <div key={mentor.id} className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setFilterMentor(mentor.id)}>
                  <div className="font-medium text-sm truncate" title={mentor.name}>{mentor.name}</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {mentorWorkload.get(mentor.id) || 0}
                  </div>
                  <div className="text-xs text-gray-600">mentees</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3">
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64"
              />
              <select
                value={filterMentor}
                onChange={(e) => setFilterMentor(e.target.value)}
                className="h-10 px-3 rounded-md border border-input bg-background"
              >
                <option value="all">All Mentors</option>
                <option value="unassigned">Unassigned</option>
                {mentors.map(mentor => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.name} ({mentorWorkload.get(mentor.id) || 0})
                  </option>
                ))}
              </select>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="h-10 px-3 rounded-md border border-input bg-background"
              >
                <option value="all">All Years</option>
                <option value="YEAR_1">Year 1</option>
                <option value="YEAR_2">Year 2</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 px-3 rounded-md border border-input bg-background"
              >
                <option value="all">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="GRADUATED">Graduated</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </select>
              <select
                value={filterAcademicYear}
                onChange={(e) => setFilterAcademicYear(e.target.value)}
                className="h-10 px-3 rounded-md border border-input bg-background"
              >
                <option value="all">All Academic Years</option>
                {academicYears.map(year => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
              {(searchTerm || filterMentor !== 'all' || filterYear !== 'all' || filterStatus !== 'ACTIVE' || filterAcademicYear !== 'all') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('')
                    setFilterMentor('all')
                    setFilterYear('all')
                    setFilterStatus('ACTIVE')
                    setFilterAcademicYear('all')
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enrollments Table */}
        <Card>
          <CardContent className="p-0">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Student</th>
                    <th className="text-left p-3 font-semibold w-24">Year</th>
                    <th className="text-left p-3 font-semibold">Mentor</th>
                    <th className="text-left p-3 font-semibold w-28">Status</th>
                    <th className="text-left p-3 font-semibold">Academic Year</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEnrollments.map(enrollment => (
                    <tr key={enrollment.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium">{enrollment.student.name}</div>
                        <div className="text-xs text-gray-500">{enrollment.student.email}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {enrollment.yearLevel === 'YEAR_1' ? 'Year 1' : 'Year 2'}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <select
                          className="h-9 px-2 text-sm rounded-md border border-input bg-background w-full max-w-xs"
                          value={enrollment.mentor?.id || ''}
                          onChange={(e) => handleMentorChange(enrollment.id, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {mentors.map(mentor => (
                            <option key={mentor.id} value={mentor.id}>
                              {mentor.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={enrollment.status === 'ACTIVE' ? 'default' : 'secondary'}
                          className={`text-xs ${
                            enrollment.status === 'GRADUATED' ? 'bg-green-100 text-green-800 border-green-200' :
                            enrollment.status === 'WITHDRAWN' ? 'bg-red-100 text-red-800 border-red-200' : ''
                          }`}
                        >
                          {enrollment.status === 'ACTIVE' ? 'Active' :
                           enrollment.status === 'GRADUATED' ? 'Graduated' : 'Withdrawn'}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="text-sm">
                          {enrollment.status === 'GRADUATED' && enrollment.graduatedAcademicYear ? (
                            <span title="Graduated in this year">
                              {enrollment.graduatedAcademicYear.name}
                            </span>
                          ) : enrollment.academicYear ? (
                            <span title="Enrolled academic year">
                              {enrollment.academicYear.name}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y">
              {filteredEnrollments.map(enrollment => (
                <div key={enrollment.id} className="p-4">
                  <div className="space-y-3">
                    <div>
                      <div className="font-medium">{enrollment.student.name}</div>
                      <div className="text-sm text-gray-500">{enrollment.student.email}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">
                        {enrollment.yearLevel === 'YEAR_1' ? 'Year 1' : 'Year 2'}
                      </Badge>
                      <Badge
                        variant={enrollment.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className={`text-xs ${
                          enrollment.status === 'GRADUATED' ? 'bg-green-100 text-green-800 border-green-200' :
                          enrollment.status === 'WITHDRAWN' ? 'bg-red-100 text-red-800 border-red-200' : ''
                        }`}
                      >
                        {enrollment.status === 'ACTIVE' ? 'Active' :
                         enrollment.status === 'GRADUATED' ? 'Graduated' : 'Withdrawn'}
                      </Badge>
                      {(enrollment.academicYear || enrollment.graduatedAcademicYear) && (
                        <Badge variant="outline" className="text-xs">
                          {enrollment.status === 'GRADUATED' && enrollment.graduatedAcademicYear
                            ? enrollment.graduatedAcademicYear.name
                            : enrollment.academicYear?.name}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">Mentor:</label>
                      <select
                        className="h-9 px-3 text-sm rounded-md border border-input bg-background w-full"
                        value={enrollment.mentor?.id || ''}
                        onChange={(e) => handleMentorChange(enrollment.id, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {mentors.map(mentor => (
                          <option key={mentor.id} value={mentor.id}>
                            {mentor.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredEnrollments.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No students found matching your filters
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
