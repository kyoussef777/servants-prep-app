'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { isAdmin } from '@/lib/roles'
import { ChevronDown, ChevronRight, Calendar, Users, Settings2, Check, Clock, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatDateUTC } from '@/lib/utils'

interface AcademicYear {
  id: string
  name: string
  isActive: boolean
}

interface Lesson {
  id: string
  title: string
  scheduledDate: string
  lessonNumber: number
  status: string
  academicYearId: string
  examSection: {
    displayName: string
  }
  _count?: {
    attendanceRecords: number
  }
}

interface Student {
  id: string
  name: string
  email: string
  enrollments: Array<{
    yearLevel: string
    mentorId: string
  }>
}

interface AttendanceRecord {
  studentId: string
  status: 'PRESENT' | 'LATE' | 'ABSENT'
  arrivedAt?: string
  notes?: string
}

export default function AttendancePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [selectedYearId, setSelectedYearId] = useState<string>('')
  const [attendance, setAttendance] = useState<Map<string, AttendanceRecord>>(new Map())
  const [existingAttendance, setExistingAttendance] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterYearLevel, setFilterYearLevel] = useState<string>('all')
  const [filterMentees, setFilterMentees] = useState(false)
  const [showCompletedLessons, setShowCompletedLessons] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [compactMode, setCompactMode] = useState(true)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role && !isAdmin(session.user.role)) {
      router.push('/dashboard')
    }
  }, [status, session, router])

  // Fetch academic years and students on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [yearsRes, enrollmentsRes] = await Promise.all([
          fetch('/api/academic-years'),
          fetch('/api/enrollments')
        ])

        if (!yearsRes.ok || !enrollmentsRes.ok) {
          setStudents([])
          setAcademicYears([])
          setLoading(false)
          return
        }

        const [yearsData, enrollmentsData] = await Promise.all([
          yearsRes.json(),
          enrollmentsRes.json()
        ])

        const years = Array.isArray(yearsData) ? yearsData : []
        setAcademicYears(years)

        // Default to active academic year for focused view
        const activeYear = years.find((y: AcademicYear) => y.isActive)
        setSelectedYearId(activeYear?.id || 'all')

        // Build student map from enrollments
        const studentMap = new Map()
        if (Array.isArray(enrollmentsData)) {
          for (const enrollment of enrollmentsData) {
            if (enrollment.isActive) {
              const student = enrollment.student
              if (!studentMap.has(student.id)) {
                studentMap.set(student.id, {
                  ...student,
                  enrollments: []
                })
              }
              studentMap.get(student.id).enrollments.push({
                yearLevel: enrollment.yearLevel,
                mentorId: enrollment.mentor?.id
              })
            }
          }
        }
        setStudents(Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
      } catch (error) {
        setStudents([])
        setAcademicYears([])
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchInitialData()
    }
  }, [session])

  // Fetch lessons when selected year changes
  useEffect(() => {
    const fetchLessons = async () => {
      try {
        // If "all" is selected, fetch all lessons
        const url = selectedYearId && selectedYearId !== 'all'
          ? `/api/lessons?academicYearId=${selectedYearId}`
          : '/api/lessons'
        const lessonsRes = await fetch(url)
        if (!lessonsRes.ok) {
          setLessons([])
          return
        }
        const lessonsData = await lessonsRes.json()
        setLessons(Array.isArray(lessonsData) ? lessonsData : [])
      } catch (error) {
        setLessons([])
      }
    }

    fetchLessons()
  }, [selectedYearId])

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!selectedLesson) return

      try {
        const res = await fetch(`/api/attendance?lessonId=${selectedLesson.id}`)
        const records = await res.json()

        const recordsMap = new Map()
        records.forEach((record: any) => {
          recordsMap.set(record.studentId, record)
        })
        setExistingAttendance(recordsMap)

        const attendanceMap = new Map()
        records.forEach((record: any) => {
          attendanceMap.set(record.studentId, {
            studentId: record.studentId,
            status: record.status,
            arrivedAt: record.arrivedAt,
            notes: record.notes
          })
        })
        setAttendance(attendanceMap)
      } catch (error) {
        console.error('Failed to fetch attendance:', error)
      }
    }

    fetchAttendance()
  }, [selectedLesson])

  const updateAttendance = (studentId: string, field: keyof AttendanceRecord, value: any) => {
    const record = attendance.get(studentId) || {
      studentId,
      status: 'PRESENT' as const,
    }

    setAttendance(new Map(attendance.set(studentId, {
      ...record,
      [field]: value
    })))
    setHasUnsavedChanges(true)
  }

  const handleMarkAllPresent = () => {
    const newAttendance = new Map(attendance)
    filteredStudents.forEach(student => {
      const existing = attendance.get(student.id)
      newAttendance.set(student.id, {
        studentId: student.id,
        status: 'PRESENT',
        arrivedAt: existing?.arrivedAt,
        notes: existing?.notes
      })
    })
    setAttendance(newAttendance)
    setHasUnsavedChanges(true)
  }

  const saveAttendance = async () => {
    if (!selectedLesson) return

    setSaving(true)
    try {
      // Prepare batch payload - all students in one request (much faster!)
      const records = filteredStudents.map(student => {
        const record = attendance.get(student.id)
        return {
          studentId: student.id,
          status: record?.status || 'ABSENT',
          arrivedAt: record?.arrivedAt || null,
          notes: record?.notes || null,
        }
      })

      const res = await fetch('/api/attendance/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: selectedLesson.id,
          records
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save attendance')
      }

      const result = await res.json()
      const now = new Date()
      setLastSaved(now)
      setHasUnsavedChanges(false)
      toast.success('Attendance saved successfully!', {
        description: `${result.created} created, ${result.updated} updated • ${now.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })}`
      })
      setSelectedLesson(null)
    } catch (error) {
      console.error('Failed to save attendance:', error)
      toast.error('Failed to save attendance', {
        description: error instanceof Error ? error.message : 'Please try again.'
      })
    } finally {
      setSaving(false)
    }
  }

  const filteredStudents = students.filter(student => {
    if (searchTerm && !student.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }

    if (filterYearLevel !== 'all') {
      if (!student.enrollments.some(e => e.yearLevel === filterYearLevel)) {
        return false
      }
    }

    if (filterMentees && session?.user?.id) {
      if (!student.enrollments.some(e => e.mentorId === session.user.id)) {
        return false
      }
    }

    return true
  })

  // Create a map of academic year IDs to names for quick lookup
  const yearNameMap = useMemo(() => {
    const map = new Map<string, string>()
    academicYears.forEach(y => map.set(y.id, y.name))
    return map
  }, [academicYears])

  // Check if we're showing all years
  const showingAllYears = selectedYearId === 'all'

  // Categorize lessons by whether attendance has been taken
  // "Scheduled" = no attendance records yet (needs attendance)
  // "Completed" = has attendance records
  const scheduledLessons = lessons
    .filter(l => (l._count?.attendanceRecords || 0) === 0)
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())

  const completedLessons = lessons
    .filter(l => (l._count?.attendanceRecords || 0) > 0)
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()) // Most recent first

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Take Attendance</h1>
            <p className="text-sm text-gray-600">
              {selectedYearId === 'all'
                ? 'Showing lessons from all academic years'
                : `${academicYears.find(y => y.id === selectedYearId)?.name || 'Selected year'} • ${lessons.length} lessons`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!selectedLesson && (
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="all">All Academic Years</option>
                {academicYears.map(year => (
                  <option key={year.id} value={year.id}>
                    {year.name}{year.isActive ? ' (Active)' : ''}
                  </option>
                ))}
              </select>
            )}
            {selectedLesson && (
              <Button variant="outline" onClick={() => setSelectedLesson(null)}>
                Change Lesson
              </Button>
            )}
          </div>
        </div>

        {/* Lesson Selection */}
        {!selectedLesson ? (
          <div className="space-y-6">
            {/* Scheduled Lessons (No attendance yet) - At the top */}
            {scheduledLessons.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Needs Attendance ({scheduledLessons.length})
                </h2>
                <div className="grid gap-2">
                  {scheduledLessons.map(lesson => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      onClick={() => setSelectedLesson(lesson)}
                      highlight="upcoming"
                      showYear={showingAllYears}
                      yearName={yearNameMap.get(lesson.academicYearId)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Completed Lessons (Has attendance) - At the bottom, collapsible */}
            {completedLessons.length > 0 && (
              <div>
                <button
                  onClick={() => setShowCompletedLessons(!showCompletedLessons)}
                  className="flex items-center gap-2 text-lg font-semibold mb-3 hover:text-gray-700"
                >
                  {showCompletedLessons ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  <Check className="w-5 h-5 text-green-600" />
                  Attendance Completed ({completedLessons.length})
                </button>
                {showCompletedLessons && (
                  <div className="grid gap-2">
                    {completedLessons.map(lesson => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        onClick={() => setSelectedLesson(lesson)}
                        highlight="completed"
                        showYear={showingAllYears}
                        yearName={yearNameMap.get(lesson.academicYearId)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Selected Lesson Info */}
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold">Lesson {selectedLesson.lessonNumber}: {selectedLesson.title}</div>
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                      {formatDateUTC(selectedLesson.scheduledDate)} | {selectedLesson.examSection.displayName}
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                        {yearNameMap.get(selectedLesson.academicYearId) || 'Unknown Year'}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {attendance.size} / {filteredStudents.length} marked
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Filters & Actions */}
            <div className="flex flex-wrap gap-2 items-center">
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs"
              />
              <select
                className="h-10 px-3 rounded-md border border-input bg-background"
                value={filterYearLevel}
                onChange={(e) => setFilterYearLevel(e.target.value)}
              >
                <option value="all">All Years</option>
                <option value="YEAR_1">Year 1</option>
                <option value="YEAR_2">Year 2</option>
              </select>
              <label className="flex items-center gap-2 px-3 h-10 border rounded-md bg-background cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterMentees}
                  onChange={(e) => setFilterMentees(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm">My Mentees</span>
              </label>
              <Button onClick={handleMarkAllPresent} variant="outline" size="sm">
                Mark All Present
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCompactMode(!compactMode)}
                className="gap-1"
              >
                <Settings2 className="h-4 w-4" />
                {compactMode ? 'Show Details' : 'Compact'}
              </Button>
            </div>

            {/* Status bar */}
            <div className="flex items-center gap-4 text-sm">
              {hasUnsavedChanges && (
                <span className="text-orange-600 font-medium">• Unsaved changes</span>
              )}
              {lastSaved && (
                <span className="text-gray-500">
                  Last saved {lastSaved.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </span>
              )}
            </div>

            {/* Excel-like Table - Desktop */}
            <Card className="hidden md:block mb-20">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-2 font-medium text-gray-700 w-8">#</th>
                      <th className="text-left p-2 font-medium text-gray-700">Name</th>
                      <th className="text-center p-2 font-medium text-gray-700 w-16">Year</th>
                      <th className="text-center p-2 font-medium text-gray-700 w-36">Status</th>
                      {!compactMode && (
                        <>
                          <th className="text-left p-2 font-medium text-gray-700 w-28">Arrived</th>
                          <th className="text-left p-2 font-medium text-gray-700">Notes</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student, index) => {
                      const record = attendance.get(student.id)
                      const yearBadge = student.enrollments[0]?.yearLevel === 'YEAR_1' ? 'Y1' : 'Y2'
                      const currentStatus = record?.status || 'ABSENT'

                      return (
                        <tr key={student.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-gray-500">{index + 1}</td>
                          <td className="p-2 font-medium">{student.name}</td>
                          <td className="p-2 text-center">
                            <Badge variant="outline" className="text-xs">
                              {yearBadge}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <div className="flex justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateAttendance(student.id, 'status', 'PRESENT')}
                                className={`p-1.5 rounded transition-colors ${
                                  currentStatus === 'PRESENT'
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'
                                }`}
                                title="Present"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => updateAttendance(student.id, 'status', 'LATE')}
                                className={`p-1.5 rounded transition-colors ${
                                  currentStatus === 'LATE'
                                    ? 'bg-yellow-500 text-white'
                                    : 'bg-gray-100 text-gray-400 hover:bg-yellow-100 hover:text-yellow-600'
                                }`}
                                title="Late"
                              >
                                <Clock className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => updateAttendance(student.id, 'status', 'ABSENT')}
                                className={`p-1.5 rounded transition-colors ${
                                  currentStatus === 'ABSENT'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600'
                                }`}
                                title="Absent"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                          {!compactMode && (
                            <>
                              <td className="p-2">
                                <Input
                                  type="time"
                                  value={record?.arrivedAt || ''}
                                  onChange={(e) => updateAttendance(student.id, 'arrivedAt', e.target.value)}
                                  className="h-7 text-xs"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="text"
                                  placeholder="Notes..."
                                  value={record?.notes || ''}
                                  onChange={(e) => updateAttendance(student.id, 'notes', e.target.value)}
                                  className="h-7 text-xs"
                                />
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Mobile Card Layout - Compact */}
            <div className="md:hidden space-y-2 pb-20">
              {filteredStudents.map((student, index) => {
                const record = attendance.get(student.id)
                const yearLevel = student.enrollments[0]?.yearLevel
                const currentStatus = record?.status || 'ABSENT'
                const isExpanded = expandedStudentId === student.id

                return (
                  <Card key={student.id} className="overflow-hidden">
                    <CardContent className="p-3">
                      {/* Compact Row - Always Visible */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-5">{index + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{student.name}</span>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {yearLevel === 'YEAR_1' ? 'Y1' : 'Y2'}
                            </Badge>
                          </div>
                        </div>
                        {/* Status Buttons */}
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateAttendance(student.id, 'status', 'PRESENT')}
                            className={`p-2 rounded transition-colors ${
                              currentStatus === 'PRESENT'
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateAttendance(student.id, 'status', 'LATE')}
                            className={`p-2 rounded transition-colors ${
                              currentStatus === 'LATE'
                                ? 'bg-yellow-500 text-white'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateAttendance(student.id, 'status', 'ABSENT')}
                            className={`p-2 rounded transition-colors ${
                              currentStatus === 'ABSENT'
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        {/* Expand button for details */}
                        {!compactMode && (
                          <button
                            type="button"
                            onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        )}
                      </div>

                      {/* Expanded Details */}
                      {!compactMode && isExpanded && (
                        <div className="mt-3 pt-3 border-t space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-gray-500">Arrival Time</label>
                              <Input
                                type="time"
                                value={record?.arrivedAt || ''}
                                onChange={(e) => updateAttendance(student.id, 'arrivedAt', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Notes</label>
                              <Input
                                type="text"
                                placeholder="Add notes..."
                                value={record?.notes || ''}
                                onChange={(e) => updateAttendance(student.id, 'notes', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Sticky Footer - Save Button */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50">
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-600">
                    {attendance.size} / {filteredStudents.length} marked
                  </span>
                  {hasUnsavedChanges && (
                    <span className="text-orange-600 font-medium">• Unsaved</span>
                  )}
                </div>
                <Button
                  onClick={saveAttendance}
                  disabled={saving}
                  size="lg"
                  className="px-8"
                >
                  {saving ? 'Saving...' : 'Save Attendance'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function LessonCard({
  lesson,
  onClick,
  highlight,
  showYear,
  yearName
}: {
  lesson: Lesson
  onClick: () => void
  highlight?: 'upcoming' | 'recent' | 'past' | 'completed'
  showYear?: boolean
  yearName?: string
}) {
  const bgColor =
    highlight === 'upcoming' ? 'bg-blue-50 border-blue-200' :
    highlight === 'recent' ? 'bg-orange-50 border-orange-200' :
    highlight === 'completed' ? 'bg-green-50 border-green-200' :
    highlight === 'past' ? 'bg-gray-50' :
    'bg-white'

  const attendanceCount = lesson._count?.attendanceRecords || 0

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-all ${bgColor}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <div className="font-semibold">Lesson {lesson.lessonNumber}: {lesson.title}</div>
            <div className="text-sm text-gray-600 flex items-center gap-2">
              {formatDateUTC(lesson.scheduledDate)}
              {attendanceCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  {attendanceCount} attended
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showYear && yearName && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                {yearName}
              </Badge>
            )}
            <Badge>{lesson.examSection.displayName}</Badge>
            {highlight === 'upcoming' && (
              <Badge className="bg-blue-600">This Week</Badge>
            )}
            {highlight === 'recent' && (
              <Badge className="bg-orange-600">Recent</Badge>
            )}
            {highlight === 'completed' && (
              <Badge className="bg-green-600">Complete</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
