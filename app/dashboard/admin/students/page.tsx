'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { isAdmin } from '@/lib/roles'
import { toast } from 'sonner'
import { GraduationCap, ChevronUp, ChevronDown, Save, Users, FileText, ChevronRight, Eye, Trash2, UserPlus } from 'lucide-react'
import { StudentDetailsModal } from '@/components/student-details-modal'
import { BulkStudentImport } from '@/components/bulk-student-import'

interface Student {
  id: string
  name: string
  email: string
  enrollments?: Array<{
    id: string
    yearLevel: 'YEAR_1' | 'YEAR_2'
    isActive: boolean
    status: 'ACTIVE' | 'GRADUATED' | 'WITHDRAWN'
    notes?: string
    mentor?: {
      id: string
      name: string
    }
  }>
}

interface StudentAnalytics {
  studentId: string
  studentName: string
  yearLevel: 'YEAR_1' | 'YEAR_2'
  attendancePercentage: number
  year1AttendancePercentage: number
  year2AttendancePercentage: number
  avgExamScore: number
  totalLessons: number
  year1TotalLessons: number
  year2TotalLessons: number
  attendedLessons: number
  year1AttendedLessons: number
  year2AttendedLessons: number
  examCount: number
}

interface ExamScore {
  id: string
  score: number
  percentage: number
  notes?: string
  exam: {
    id: string
    examDate: string | Date
    totalPoints: number
    examSection: {
      id: string
      name: string
      displayName: string
      yearLevel: string
    }
  }
  grader?: {
    id: string
    name: string
  }
}

interface AttendanceRecord {
  id: string
  status: 'PRESENT' | 'LATE' | 'ABSENT'
  arrivedAt?: string | Date
  notes?: string
  lesson: {
    id: string
    title: string
    scheduledDate: string | Date
    examSection: {
      id: string
      name: string
      yearLevel: string
    }
  }
  recorder?: {
    id: string
    name: string
  }
}

interface Exam {
  id: string
  examDate: string | Date
  totalPoints: number
  yearLevel: string
  examSection: {
    id: string
    name: string
    displayName: string
  }
}

interface Lesson {
  id: string
  title: string
  scheduledDate: string | Date
  examSection: {
    id: string
    name: string
    displayName: string
  }
}

interface StudentDetails {
  student: Student
  examScores: ExamScore[]
  attendanceRecords: AttendanceRecord[]
  allExams: Exam[]
  allLessons: Lesson[]
}

export default function StudentsManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [analytics, setAnalytics] = useState<StudentAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [filterYearLevel, setFilterYearLevel] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesText, setNotesText] = useState('')
  const [showGraduateDialog, setShowGraduateDialog] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)
  const [viewingStudent, setViewingStudent] = useState<string | null>(null)
  const [studentDetails, setStudentDetails] = useState<StudentDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [academicYearId, setAcademicYearId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role && !isAdmin(session.user.role)) {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user) {
      fetchStudents()
    }
  }, [session])

  const fetchStudents = async () => {
    try {
      // Fetch students and academic years in parallel (much faster!)
      const [studentsRes, yearsRes] = await Promise.all([
        fetch('/api/users?role=STUDENT'),
        fetch('/api/academic-years')
      ])

      if (studentsRes.ok) {
        const data = await studentsRes.json()
        setStudents(data)
      }

      if (yearsRes.ok) {
        const years = await yearsRes.json()
        const activeYear = years.find((y: { isActive: boolean }) => y.isActive)

        if (activeYear) {
          setAcademicYearId(activeYear.id)
          // Fetch analytics (this depends on academic year, so can't be parallelized with above)
          const analyticsRes = await fetch(`/api/students/analytics/batch?academicYearId=${activeYear.id}`)
          if (analyticsRes.ok) {
            const analyticsData = await analyticsRes.json()
            setAnalytics(analyticsData)
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch students:', error)
    } finally {
      setLoading(false)
    }
  }

  const openStudentDetails = async (studentId: string) => {
    if (!academicYearId) return

    setViewingStudent(studentId)
    setDetailsLoading(true)

    try {
      const res = await fetch(`/api/students/${studentId}/details?academicYearId=${academicYearId}`)
      if (res.ok) {
        const data = await res.json()
        setStudentDetails(data)
      } else {
        toast.error('Failed to load student details')
      }
    } catch (error) {
      console.error('Failed to fetch student details:', error)
      toast.error('Failed to load student details')
    } finally {
      setDetailsLoading(false)
    }
  }

  const refreshStudentDetails = async () => {
    if (viewingStudent && academicYearId) {
      await openStudentDetails(viewingStudent)
      await fetchStudents()
    }
  }

  const toggleStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents)
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId)
    } else {
      newSelected.add(studentId)
    }
    setSelectedStudents(newSelected)
  }

  const selectAll = () => {
    const filtered = getFilteredStudents()
    if (selectedStudents.size === filtered.length) {
      setSelectedStudents(new Set())
    } else {
      setSelectedStudents(new Set(filtered.map(s => s.id)))
    }
  }

  const updateYearLevel = async (studentIds: string[], yearLevel: 'YEAR_1' | 'YEAR_2') => {
    try {
      for (const studentId of studentIds) {
        const student = students.find(s => s.id === studentId)
        if (student?.enrollments?.[0]) {
          await fetch(`/api/enrollments/${student.enrollments[0].id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ yearLevel })
          })
        }
      }

      const now = new Date()
      setLastSaved(now)
      toast.success(`Updated ${studentIds.length} student(s) to ${yearLevel === 'YEAR_1' ? 'Year 1' : 'Year 2'}`, {
        description: now.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      })

      await fetchStudents()
      setSelectedStudents(new Set())
    } catch (error) {
      toast.error('Failed to update year level')
    }
  }

  const updateEnrollmentStatus = async (studentIds: string[], status: 'ACTIVE' | 'GRADUATED' | 'WITHDRAWN') => {
    try {
      for (const studentId of studentIds) {
        const student = students.find(s => s.id === studentId)
        if (student?.enrollments?.[0]) {
          await fetch(`/api/enrollments/${student.enrollments[0].id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status,
              isActive: status === 'ACTIVE'
            })
          })
        }
      }

      const now = new Date()
      setLastSaved(now)
      const statusText = status === 'GRADUATED' ? 'Graduated' : status === 'WITHDRAWN' ? 'Withdrawn' : 'Active'
      toast.success(`Marked ${studentIds.length} student(s) as ${statusText}`, {
        description: now.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      })

      await fetchStudents()
      setSelectedStudents(new Set())
      setShowGraduateDialog(false)
    } catch (error) {
      toast.error('Failed to update enrollment status')
    }
  }

  const saveNotes = async (studentId: string) => {
    try {
      const student = students.find(s => s.id === studentId)
      if (!student?.enrollments?.[0]) return

      await fetch(`/api/enrollments/${student.enrollments[0].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesText })
      })

      const now = new Date()
      setLastSaved(now)
      toast.success('Notes saved successfully!', {
        description: now.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      })

      await fetchStudents()
      setEditingNotes(null)
      setNotesText('')
    } catch (error) {
      toast.error('Failed to save notes')
    }
  }

  const bulkDeleteUsers = async (userIds: string[]) => {
    if (!confirm(`Are you sure you want to permanently delete ${userIds.length} user(s)? This action cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch('/api/users/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds })
      })

      if (res.ok) {
        const result = await res.json()
        toast.success(result.message)
        await fetchStudents()
        setSelectedStudents(new Set())
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to delete users')
      }
    } catch (error) {
      console.error('Failed to delete users:', error)
      toast.error('Failed to delete users')
    }
  }

  const createEnrollments = async (studentIds: string[], yearLevel: 'YEAR_1' | 'YEAR_2') => {
    try {
      for (const studentId of studentIds) {
        const res = await fetch('/api/enrollments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId,
            yearLevel,
            isActive: true
          })
        })

        if (!res.ok) {
          const error = await res.json()
          toast.error(`Failed to enroll student: ${error.error}`)
          return
        }
      }

      toast.success(`Successfully enrolled ${studentIds.length} student(s) in ${yearLevel === 'YEAR_1' ? 'Year 1' : 'Year 2'}`)
      await fetchStudents()
      setSelectedStudents(new Set())
    } catch (error) {
      console.error('Failed to create enrollments:', error)
      toast.error('Failed to create enrollments')
    }
  }

  const getFilteredStudents = () => {
    return students.filter(student => {
      if (searchTerm && !student.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }

      if (filterYearLevel !== 'all' && student.enrollments?.[0]?.yearLevel !== filterYearLevel) {
        return false
      }

      if (filterStatus !== 'all' && student.enrollments?.[0]?.status !== filterStatus) {
        return false
      }

      return true
    })
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const filteredStudents = getFilteredStudents()
  const activeCount = students.filter(s => s.enrollments?.[0]?.status === 'ACTIVE').length
  const graduatedCount = students.filter(s => s.enrollments?.[0]?.status === 'GRADUATED').length
  const year1Count = students.filter(s => s.enrollments?.[0]?.yearLevel === 'YEAR_1' && s.enrollments?.[0]?.status === 'ACTIVE').length
  const year2Count = students.filter(s => s.enrollments?.[0]?.yearLevel === 'YEAR_2' && s.enrollments?.[0]?.status === 'ACTIVE').length

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Student Management</h1>
          <p className="text-gray-600 mt-1">Manage student year levels, graduation status, and notes</p>
          {lastSaved && (
            <p className="text-xs text-gray-500 mt-1">
              Last saved {lastSaved.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}
            </p>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{activeCount}</div>
              <div className="text-sm text-gray-600">Active Students</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{year1Count}</div>
              <div className="text-sm text-gray-600">Year 1 Students</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{year2Count}</div>
              <div className="text-sm text-gray-600">Year 2 Students</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{graduatedCount}</div>
              <div className="text-sm text-gray-600">Graduated</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Bulk Actions */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle>Students ({filteredStudents.length})</CardTitle>
              <div className="flex flex-wrap gap-2">
                {session?.user?.role === 'SUPER_ADMIN' && (
                  <BulkStudentImport onSuccess={fetchStudents} />
                )}
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48"
                />
                <select
                  value={filterYearLevel}
                  onChange={(e) => setFilterYearLevel(e.target.value)}
                  className="border rounded-md px-3 py-2 text-sm"
                >
                  <option value="all">All Years</option>
                  <option value="YEAR_1">Year 1</option>
                  <option value="YEAR_2">Year 2</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border rounded-md px-3 py-2 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="GRADUATED">Graduated</option>
                  <option value="WITHDRAWN">Withdrawn</option>
                </select>
              </div>
            </div>
          </CardHeader>

          {selectedStudents.size > 0 && (
            <div className="px-6 pb-4">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium">
                      {selectedStudents.size} student(s) selected
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateYearLevel(Array.from(selectedStudents), 'YEAR_1')}
                        className="gap-1"
                      >
                        <ChevronDown className="h-3 w-3" />
                        Move to Year 1
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateYearLevel(Array.from(selectedStudents), 'YEAR_2')}
                        className="gap-1"
                      >
                        <ChevronUp className="h-3 w-3" />
                        Move to Year 2
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => createEnrollments(Array.from(selectedStudents), 'YEAR_1')}
                        className="gap-1 text-blue-700 border-blue-300 hover:bg-blue-50"
                      >
                        <UserPlus className="h-3 w-3" />
                        Enroll in Year 1
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => createEnrollments(Array.from(selectedStudents), 'YEAR_2')}
                        className="gap-1 text-blue-700 border-blue-300 hover:bg-blue-50"
                      >
                        <UserPlus className="h-3 w-3" />
                        Enroll in Year 2
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowGraduateDialog(true)}
                        className="gap-1 text-green-700 border-green-300 hover:bg-green-50"
                      >
                        <GraduationCap className="h-3 w-3" />
                        Mark as Graduated
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateEnrollmentStatus(Array.from(selectedStudents), 'WITHDRAWN')}
                        className="gap-1 text-orange-700 border-orange-300 hover:bg-orange-50"
                      >
                        Mark as Withdrawn
                      </Button>
                      {session?.user?.role === 'SUPER_ADMIN' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => bulkDeleteUsers(Array.from(selectedStudents))}
                          className="gap-1 text-red-700 border-red-300 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete Users
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedStudents(new Set())}
                      >
                        Clear Selection
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <CardContent>
            {/* Desktop View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-3">
                      <input
                        type="checkbox"
                        checked={selectedStudents.size === filteredStudents.length && filteredStudents.length > 0}
                        onChange={selectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left p-3 font-semibold">Name</th>
                    <th className="text-left p-3 font-semibold">Year</th>
                    <th className="text-left p-3 font-semibold">Year 1 Attendance</th>
                    <th className="text-left p-3 font-semibold">Year 2 Attendance</th>
                    <th className="text-left p-3 font-semibold">Exam Avg</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(student => {
                    const studentAnalytics = analytics.find(a => a.studentId === student.id)
                    const year1Color = !studentAnalytics ? 'text-gray-400' :
                      studentAnalytics.year1AttendancePercentage >= 75 ? 'text-green-700' :
                      studentAnalytics.year1AttendancePercentage >= 60 ? 'text-yellow-700' : 'text-red-700'
                    const year2Color = !studentAnalytics ? 'text-gray-400' :
                      studentAnalytics.year2AttendancePercentage >= 75 ? 'text-green-700' :
                      studentAnalytics.year2AttendancePercentage >= 60 ? 'text-yellow-700' : 'text-red-700'
                    const examColor = !studentAnalytics ? 'text-gray-400' :
                      studentAnalytics.avgExamScore >= 75 ? 'text-green-700' :
                      studentAnalytics.avgExamScore >= 60 ? 'text-yellow-700' : 'text-red-700'

                    return (
                      <tr key={student.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedStudents.has(student.id)}
                            onChange={() => toggleStudent(student.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{student.name}</div>
                          <div className="text-xs text-gray-500">{student.email}</div>
                        </td>
                        <td className="p-3">
                          {student.enrollments?.[0] ? (
                            <Badge variant="outline">
                              {student.enrollments[0].yearLevel === 'YEAR_1' ? 'Year 1' : 'Year 2'}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">Not enrolled</span>
                          )}
                        </td>
                        <td className="p-3">
                          {studentAnalytics ? (
                            <div>
                              <div className={`font-semibold ${year1Color}`}>
                                {studentAnalytics.year1AttendancePercentage.toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-500">
                                {studentAnalytics.year1AttendedLessons}/{studentAnalytics.year1TotalLessons} lessons
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">N/A</span>
                          )}
                        </td>
                        <td className="p-3">
                          {studentAnalytics ? (
                            <div>
                              <div className={`font-semibold ${year2Color}`}>
                                {studentAnalytics.year2AttendancePercentage.toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-500">
                                {studentAnalytics.year2AttendedLessons}/{studentAnalytics.year2TotalLessons} lessons
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">N/A</span>
                          )}
                        </td>
                        <td className="p-3">
                          {studentAnalytics ? (
                            <div>
                              <div className={`font-semibold ${examColor}`}>
                                {studentAnalytics.avgExamScore.toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-500">
                                {studentAnalytics.examCount} exam{studentAnalytics.examCount !== 1 ? 's' : ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">N/A</span>
                          )}
                        </td>
                        <td className="p-3">
                          {student.enrollments?.[0]?.status === 'ACTIVE' && (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          )}
                          {student.enrollments?.[0]?.status === 'GRADUATED' && (
                            <Badge className="bg-blue-100 text-blue-800">Graduated</Badge>
                          )}
                          {student.enrollments?.[0]?.status === 'WITHDRAWN' && (
                            <Badge className="bg-gray-100 text-gray-800">Withdrawn</Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openStudentDetails(student.id)}
                              className="gap-1"
                              title="View Details"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingNotes(student.id)
                                setNotesText(student.enrollments?.[0]?.notes || '')
                              }}
                              className="gap-1"
                              title="Edit Notes"
                            >
                              <FileText className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden space-y-3">
              {filteredStudents.map(student => {
                const studentAnalytics = analytics.find(a => a.studentId === student.id)
                const isExpanded = expandedStudent === student.id
                const year1Color = !studentAnalytics ? 'text-gray-400' :
                  studentAnalytics.year1AttendancePercentage >= 75 ? 'text-green-700' :
                  studentAnalytics.year1AttendancePercentage >= 60 ? 'text-yellow-700' : 'text-red-700'
                const year2Color = !studentAnalytics ? 'text-gray-400' :
                  studentAnalytics.year2AttendancePercentage >= 75 ? 'text-green-700' :
                  studentAnalytics.year2AttendancePercentage >= 60 ? 'text-yellow-700' : 'text-red-700'
                const examColor = !studentAnalytics ? 'text-gray-400' :
                  studentAnalytics.avgExamScore >= 75 ? 'text-green-700' :
                  studentAnalytics.avgExamScore >= 60 ? 'text-yellow-700' : 'text-red-700'

                return (
                  <Card key={student.id} className="overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedStudents.has(student.id)}
                            onChange={() => toggleStudent(student.id)}
                            className="rounded mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">{student.name}</div>
                            <div className="text-sm text-gray-500 truncate">{student.email}</div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {student.enrollments?.[0] && (
                                <Badge variant="outline" className="text-xs">
                                  {student.enrollments[0].yearLevel === 'YEAR_1' ? 'Year 1' : 'Year 2'}
                                </Badge>
                              )}
                              {student.enrollments?.[0]?.status === 'ACTIVE' && (
                                <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>
                              )}
                              {student.enrollments?.[0]?.status === 'GRADUATED' && (
                                <Badge className="bg-blue-100 text-blue-800 text-xs">Graduated</Badge>
                              )}
                              {student.enrollments?.[0]?.status === 'WITHDRAWN' && (
                                <Badge className="bg-gray-100 text-gray-800 text-xs">Withdrawn</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                          className="ml-2"
                        >
                          <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </Button>
                      </div>

                      {/* Quick Stats */}
                      {studentAnalytics && (
                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">
                          <div>
                            <div className="text-xs text-gray-500">Year 1</div>
                            <div className={`text-base font-semibold ${year1Color}`}>
                              {studentAnalytics.year1AttendancePercentage.toFixed(1)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Year 2</div>
                            <div className={`text-base font-semibold ${year2Color}`}>
                              {studentAnalytics.year2AttendancePercentage.toFixed(1)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Exam Avg</div>
                            <div className={`text-base font-semibold ${examColor}`}>
                              {studentAnalytics.avgExamScore.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t space-y-2">
                          {studentAnalytics && (
                            <>
                              <div className="text-sm">
                                <span className="text-gray-600">Year 1 lessons:</span>
                                <span className="ml-2 font-medium">
                                  {studentAnalytics.year1AttendedLessons}/{studentAnalytics.year1TotalLessons}
                                </span>
                              </div>
                              <div className="text-sm">
                                <span className="text-gray-600">Year 2 lessons:</span>
                                <span className="ml-2 font-medium">
                                  {studentAnalytics.year2AttendedLessons}/{studentAnalytics.year2TotalLessons}
                                </span>
                              </div>
                              <div className="text-sm">
                                <span className="text-gray-600">Exams taken:</span>
                                <span className="ml-2 font-medium">{studentAnalytics.examCount}</span>
                              </div>
                            </>
                          )}
                          {student.enrollments?.[0]?.mentor && (
                            <div className="text-sm">
                              <span className="text-gray-600">Mentor:</span>
                              <span className="ml-2 font-medium">{student.enrollments[0].mentor.name}</span>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openStudentDetails(student.id)}
                              className="w-full gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              Details
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingNotes(student.id)
                                setNotesText(student.enrollments?.[0]?.notes || '')
                              }}
                              className="w-full gap-1"
                            >
                              <FileText className="h-3 w-3" />
                              Notes
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>

            {filteredStudents.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No students found matching your filters
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes Dialog */}
      <Dialog open={editingNotes !== null} onOpenChange={(open) => !open && setEditingNotes(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Student Notes</DialogTitle>
            <DialogDescription>
              Add notes for {students.find(s => s.id === editingNotes)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Add notes about this student..."
              rows={6}
              className="w-full"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingNotes(null)}>
                Cancel
              </Button>
              <Button onClick={() => editingNotes && saveNotes(editingNotes)} className="gap-1">
                <Save className="h-4 w-4" />
                Save Notes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Graduate Confirmation Dialog */}
      <Dialog open={showGraduateDialog} onOpenChange={setShowGraduateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Students as Graduated</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark {selectedStudents.size} student(s) as graduated?
              This will archive them from the active student list.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowGraduateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateEnrollmentStatus(Array.from(selectedStudents), 'GRADUATED')}
              className="gap-1 bg-green-600 hover:bg-green-700"
            >
              <GraduationCap className="h-4 w-4" />
              Confirm Graduation
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Student Details Modal */}
      <StudentDetailsModal
        studentId={viewingStudent}
        studentName={students.find(s => s.id === viewingStudent)?.name || ''}
        yearLevel={studentDetails?.student?.enrollments?.[0]?.yearLevel}
        mentor={studentDetails?.student?.enrollments?.[0]?.mentor}
        examScores={studentDetails?.examScores || []}
        attendanceRecords={studentDetails?.attendanceRecords || []}
        allExams={studentDetails?.allExams || []}
        allLessons={studentDetails?.allLessons || []}
        loading={detailsLoading}
        onClose={() => {
          setViewingStudent(null)
          setStudentDetails(null)
        }}
        onRefresh={refreshStudentDetails}
      />
    </div>
  )
}
