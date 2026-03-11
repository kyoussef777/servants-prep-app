'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { isAdmin, canManageData } from '@/lib/roles'
import { ChevronDown, ChevronRight, Calendar, Settings2, Check, Clock, X, Shield, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { formatDateUTC } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

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
  isExamDay?: boolean
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
  profileImageUrl?: string | null
  enrollments: Array<{
    yearLevel: string
    mentorId: string
  }>
}

interface AttendanceRecord {
  studentId: string
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'
  arrivedAt?: string
  notes?: string
  conductRemoval?: boolean
  conductNote?: string
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
  const [, setExistingAttendance] = useState<Map<string, AttendanceRecord>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterYearLevel, setFilterYearLevel] = useState<string>('all')
  const [filterMentees, setFilterMentees] = useState(false)
  const [showCompletedLessons, setShowCompletedLessons] = useState(false)
  const [lessonStatusFilter, setLessonStatusFilter] = useState<string>('all')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [compactMode, setCompactMode] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)
  const [viewingPhoto, setViewingPhoto] = useState<{ name: string; url: string } | null>(null)
  const [conductRemovalDialog, setConductRemovalDialog] = useState<{ studentId: string; studentName: string } | null>(null)
  const [conductNoteInput, setConductNoteInput] = useState('')

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
      } catch {
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
  // Exclude cancelled and exam day lessons at the API level (not needed for attendance)
  useEffect(() => {
    const fetchLessons = async () => {
      try {
        // Build URL with forAttendance filter - excludes cancelled and exam day lessons
        const params = new URLSearchParams({ forAttendance: 'true' })
        if (selectedYearId && selectedYearId !== 'all') {
          params.set('academicYearId', selectedYearId)
        }
        const url = `/api/lessons?${params.toString()}`
        const lessonsRes = await fetch(url)
        if (!lessonsRes.ok) {
          setLessons([])
          return
        }
        const lessonsData = await lessonsRes.json()
        setLessons(Array.isArray(lessonsData) ? lessonsData : [])
      } catch {
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

        const recordsMap = new Map<string, AttendanceRecord>()
        records.forEach((record: AttendanceRecord & { studentId: string; conductRemoval?: boolean; conductNote?: string }) => {
          recordsMap.set(record.studentId, record)
        })
        setExistingAttendance(recordsMap)

        const attendanceMap = new Map<string, AttendanceRecord>()
        records.forEach((record: AttendanceRecord & { studentId: string }) => {
          attendanceMap.set(record.studentId, {
            studentId: record.studentId,
            status: record.status,
            arrivedAt: record.arrivedAt,
            notes: record.notes,
            conductRemoval: record.conductRemoval,
            conductNote: record.conductNote,
          })
        })
        setAttendance(attendanceMap)
      } catch (error) {
        console.error('Failed to fetch attendance:', error)
      }
    }

    fetchAttendance()
  }, [selectedLesson])

  const updateAttendance = (studentId: string, field: keyof AttendanceRecord, value: string) => {
    const record = attendance.get(studentId) || {
      studentId,
      status: 'PRESENT' as const,
    }

    // Changing the status directly clears any conduct removal
    const updates: Partial<AttendanceRecord> = { [field]: value }
    if (field === 'status') {
      updates.conductRemoval = false
      updates.conductNote = undefined
    }

    setAttendance(new Map(attendance.set(studentId, {
      ...record,
      ...updates,
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

  const handleConductRemovalClick = (studentId: string, studentName: string) => {
    const record = attendance.get(studentId)
    if (record?.conductRemoval) {
      // Toggle off - clear the conduct removal
      setAttendance(new Map(attendance.set(studentId, {
        ...record,
        status: 'ABSENT',
        conductRemoval: false,
        conductNote: undefined,
      })))
      setHasUnsavedChanges(true)
    } else {
      // Open dialog to get reason
      setConductNoteInput('')
      setConductRemovalDialog({ studentId, studentName })
    }
  }

  const confirmConductRemoval = () => {
    if (!conductRemovalDialog) return
    if (!conductNoteInput.trim()) {
      toast.error('A reason is required', { description: 'Please provide a reason for removing the student.' })
      return
    }
    const { studentId } = conductRemovalDialog
    const record = attendance.get(studentId) || { studentId, status: 'ABSENT' as const }
    setAttendance(new Map(attendance.set(studentId, {
      ...record,
      status: 'ABSENT',
      conductRemoval: true,
      conductNote: conductNoteInput.trim(),
    })))
    setHasUnsavedChanges(true)
    setConductRemovalDialog(null)
    setConductNoteInput('')
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
          conductRemoval: record?.conductRemoval || false,
          conductNote: record?.conductNote || null,
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

  // Filter lessons by status (lesson status field, not attendance status)
  // Note: Cancelled and exam day lessons are already excluded at the API level
  const filteredLessons = lessons.filter(l => {
    // Apply lesson status filter if set
    if (lessonStatusFilter !== 'all' && l.status !== lessonStatusFilter) return false
    return true
  })

  // Categorize lessons by whether attendance has been taken
  // "Needs Attendance" = no attendance records yet (shown at top)
  // "Completed" = has attendance records (shown at bottom)
  const scheduledLessons = filteredLessons
    .filter(l => (l._count?.attendanceRecords || 0) === 0)
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())

  const completedLessons = filteredLessons
    .filter(l => (l._count?.attendanceRecords || 0) > 0)
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()) // Most recent first

  // Check if user can manage data (PRIEST is read-only)
  const userCanManageData = session?.user?.role ? canManageData(session.user.role) : false

  // Check if selected lesson is today or in the past (attendance can only be taken on or after the lesson date)
  const isLessonEditable = useMemo(() => {
    if (!selectedLesson) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const lessonDate = new Date(selectedLesson.scheduledDate)
    lessonDate.setHours(0, 0, 0, 0)
    return lessonDate <= today
  }, [selectedLesson])

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 md:p-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Take Attendance</h1>
            <p className="text-xs sm:text-sm text-gray-600">
              {selectedYearId === 'all'
                ? 'All academic years'
                : `${academicYears.find(y => y.id === selectedYearId)?.name || 'Selected year'} • ${lessons.length} lessons`}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {!selectedLesson && (
              <>
                <select
                  value={selectedYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                  className="h-8 sm:h-10 px-2 sm:px-3 rounded-md border border-input bg-background text-xs sm:text-sm flex-1 sm:flex-none dark:bg-gray-800 dark:text-white dark:border-gray-600"
                >
                  <option value="all">All Years</option>
                  {academicYears.map(year => (
                    <option key={year.id} value={year.id}>
                      {year.name.replace('Academic Year ', '')}{year.isActive ? ' ✓' : ''}
                    </option>
                  ))}
                </select>
                <select
                  value={lessonStatusFilter}
                  onChange={(e) => setLessonStatusFilter(e.target.value)}
                  className="h-8 sm:h-10 px-2 sm:px-3 rounded-md border border-input bg-background text-xs sm:text-sm dark:bg-gray-800 dark:text-white dark:border-gray-600"
                >
                  <option value="all">All Statuses</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </>
            )}
            {selectedLesson && (
              <Button variant="outline" size="sm" onClick={() => setSelectedLesson(null)} className="text-xs sm:text-sm">
                Change Lesson
              </Button>
            )}
          </div>
        </div>

        {/* Lesson Selection */}
        {!selectedLesson ? (
          <div className="space-y-4 sm:space-y-6">
            {/* Scheduled Lessons (No attendance yet) - At the top */}
            {scheduledLessons.length > 0 && (
              <div>
                <h2 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-maroon-600" />
                  Needs Attendance ({scheduledLessons.length})
                </h2>
                <div className="grid gap-2">
                  {scheduledLessons.map(lesson => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      onClick={() => setSelectedLesson(lesson)}
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
                  className="w-full flex items-center gap-2 text-base sm:text-lg font-semibold mb-2 sm:mb-3 hover:text-gray-700 transition-colors dark:hover:text-gray-300"
                >
                  {showCompletedLessons ? <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />}
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  <span>Completed ({completedLessons.length})</span>
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
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex justify-between items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm sm:text-base truncate">L{selectedLesson.lessonNumber}: {selectedLesson.title}</div>
                    <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-1 sm:gap-2 flex-wrap">
                      <span>{formatDateUTC(selectedLesson.scheduledDate, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <span className="hidden sm:inline">|</span>
                      <Badge className="text-[10px] sm:text-xs px-1 sm:px-2">{selectedLesson.examSection.displayName}</Badge>
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 shrink-0">
                    {attendance.size}/{filteredStudents.length}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Future lesson warning */}
            {!isLessonEditable && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                Attendance cannot be edited until the lesson date ({formatDateUTC(selectedLesson.scheduledDate, { weekday: 'short', month: 'short', day: 'numeric' })}).
              </div>
            )}

            {/* Sticky Filters & Actions */}
            <div className="sticky top-0 z-20 bg-gray-50 py-2 -mx-2 px-2 sm:-mx-4 sm:px-4 md:-mx-8 md:px-8 space-y-2">
              <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 sm:h-10 text-xs sm:text-sm w-28 sm:max-w-xs"
                />
                <select
                  className="h-8 sm:h-10 px-2 sm:px-3 rounded-md border border-input bg-background text-xs sm:text-sm dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  value={filterYearLevel}
                  onChange={(e) => setFilterYearLevel(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="YEAR_1">Y1</option>
                  <option value="YEAR_2">Y2</option>
                </select>
                <label className="flex items-center gap-1.5 px-2 sm:px-3 h-8 sm:h-10 border rounded-md bg-background cursor-pointer text-xs sm:text-sm">
                  <input
                    type="checkbox"
                    checked={filterMentees}
                    onChange={(e) => setFilterMentees(e.target.checked)}
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                  />
                  <span className="hidden sm:inline">My Mentees</span>
                  <span className="sm:hidden">Mine</span>
                </label>
                <Button onClick={handleMarkAllPresent} variant="outline" size="sm" disabled={!isLessonEditable} className="h-8 sm:h-10 text-xs sm:text-sm px-2 sm:px-3">
                  <span className="hidden sm:inline">Mark All Present</span>
                  <span className="sm:hidden">All ✓</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCompactMode(!compactMode)}
                  className="h-8 sm:h-10 text-xs sm:text-sm px-2 sm:px-3 gap-1"
                >
                  <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{compactMode ? 'Details' : 'Compact'}</span>
                </Button>
              </div>

              {/* Status bar */}
              <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                {hasUnsavedChanges && (
                  <span className="text-orange-600 font-medium">• Unsaved</span>
                )}
                {lastSaved && (
                  <span className="text-gray-500">
                    Saved {lastSaved.toLocaleString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </span>
                )}
              </div>
            </div>

            {/* Excel-like Table - Desktop */}
            <Card className="hidden md:block mb-20">
              <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-2 font-medium text-gray-700 w-8 bg-gray-50">#</th>
                      <th className="text-left p-2 font-medium text-gray-700 bg-gray-50">Name</th>
                      <th className="text-center p-2 font-medium text-gray-700 w-16 bg-gray-50">Year</th>
                      <th className="text-center p-2 font-medium text-gray-700 w-44 bg-gray-50">Status</th>
                      {!compactMode && (
                        <>
                          <th className="text-left p-2 font-medium text-gray-700 w-28 bg-gray-50">Arrived</th>
                          <th className="text-left p-2 font-medium text-gray-700 bg-gray-50">Notes</th>
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
                          <td className="p-2 font-medium">
                            <div className="flex items-center gap-2">
                              <Avatar
                                className={`h-7 w-7 shrink-0 ${student.profileImageUrl ? 'cursor-pointer hover:ring-2 hover:ring-maroon-400' : ''}`}
                                onClick={() => student.profileImageUrl && setViewingPhoto({ name: student.name, url: student.profileImageUrl })}
                              >
                                {student.profileImageUrl && (
                                  <AvatarImage src={student.profileImageUrl} alt={student.name} />
                                )}
                                <AvatarFallback className="bg-maroon-600 text-white text-xs">
                                  {student.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              {student.name}
                            </div>
                          </td>
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
                                disabled={!userCanManageData || !isLessonEditable}
                                className={`p-1.5 rounded transition-colors ${
                                  currentStatus === 'PRESENT' && !record?.conductRemoval
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'
                                } ${!userCanManageData || !isLessonEditable ? 'cursor-not-allowed opacity-60' : ''}`}
                                title="Present"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => updateAttendance(student.id, 'status', 'LATE')}
                                disabled={!userCanManageData || !isLessonEditable}
                                className={`p-1.5 rounded transition-colors ${
                                  currentStatus === 'LATE'
                                    ? 'bg-yellow-500 text-white'
                                    : 'bg-gray-100 text-gray-400 hover:bg-yellow-100 hover:text-yellow-600'
                                } ${!userCanManageData || !isLessonEditable ? 'cursor-not-allowed opacity-60' : ''}`}
                                title="Late"
                              >
                                <Clock className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => updateAttendance(student.id, 'status', 'ABSENT')}
                                disabled={!userCanManageData || !isLessonEditable}
                                className={`p-1.5 rounded transition-colors ${
                                  currentStatus === 'ABSENT' && !record?.conductRemoval
                                    ? 'bg-red-500 text-white'
                                    : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600'
                                } ${!userCanManageData || !isLessonEditable ? 'cursor-not-allowed opacity-60' : ''}`}
                                title="Absent"
                              >
                                <X className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => updateAttendance(student.id, 'status', 'EXCUSED')}
                                disabled={!userCanManageData || !isLessonEditable}
                                className={`p-1.5 rounded transition-colors ${
                                  currentStatus === 'EXCUSED'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-400 hover:bg-blue-100 hover:text-blue-600'
                                } ${!userCanManageData || !isLessonEditable ? 'cursor-not-allowed opacity-60' : ''}`}
                                title="Excused (not counted)"
                              >
                                <Shield className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConductRemovalClick(student.id, student.name)}
                                disabled={!userCanManageData || !isLessonEditable}
                                className={`p-1.5 rounded transition-colors ${
                                  record?.conductRemoval
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-gray-100 text-gray-400 hover:bg-orange-100 hover:text-orange-600'
                                } ${!userCanManageData || !isLessonEditable ? 'cursor-not-allowed opacity-60' : ''}`}
                                title={record?.conductRemoval ? `Removed from lesson: ${record.conductNote}` : 'Remove from Lesson (conduct)'}
                              >
                                <UserX className="h-4 w-4" />
                              </button>
                            </div>
                            {record?.conductRemoval && record.conductNote && (
                              <p className="text-[10px] text-orange-600 mt-1 text-center max-w-[200px] mx-auto truncate" title={record.conductNote}>
                                {record.conductNote}
                              </p>
                            )}
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
            <div className="md:hidden space-y-2 pb-20 overflow-x-hidden">
              {filteredStudents.map((student, index) => {
                const record = attendance.get(student.id)
                const yearLevel = student.enrollments[0]?.yearLevel
                const currentStatus = record?.status || 'ABSENT'
                const isExpanded = expandedStudentId === student.id

                return (
                  <Card key={student.id} className="overflow-hidden">
                    <CardContent className="px-2 py-1.5 sm:p-3">
                      {/* Single row: # Avatar Name [Y1] [P][L][A][E] [>] */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400 w-3 shrink-0 text-center">{index + 1}</span>
                        <Avatar
                          className={`h-7 w-7 shrink-0 ${student.profileImageUrl ? 'cursor-pointer hover:ring-2 hover:ring-maroon-400' : ''}`}
                          onClick={() => student.profileImageUrl && setViewingPhoto({ name: student.name, url: student.profileImageUrl })}
                        >
                          {student.profileImageUrl && (
                            <AvatarImage src={student.profileImageUrl} alt={student.name} className="object-cover" />
                          )}
                          <AvatarFallback className="bg-maroon-600 text-white text-[9px]">
                            {student.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm leading-tight truncate flex-1 min-w-0">{student.name}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0 px-0.5 py-0">
                          {yearLevel === 'YEAR_1' ? 'Y1' : 'Y2'}
                        </Badge>
                        <div className="flex shrink-0">
                          <button
                            type="button"
                            onClick={() => updateAttendance(student.id, 'status', 'PRESENT')}
                            disabled={!userCanManageData || !isLessonEditable}
                            className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${
                              currentStatus === 'PRESENT' && !record?.conductRemoval
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-100 text-gray-400'
                            } ${!userCanManageData || !isLessonEditable ? 'cursor-not-allowed opacity-60' : ''}`}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateAttendance(student.id, 'status', 'LATE')}
                            disabled={!userCanManageData || !isLessonEditable}
                            className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${
                              currentStatus === 'LATE'
                                ? 'bg-yellow-500 text-white'
                                : 'bg-gray-100 text-gray-400'
                            } ${!userCanManageData || !isLessonEditable ? 'cursor-not-allowed opacity-60' : ''}`}
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateAttendance(student.id, 'status', 'ABSENT')}
                            disabled={!userCanManageData || !isLessonEditable}
                            className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${
                              currentStatus === 'ABSENT' && !record?.conductRemoval
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-100 text-gray-400'
                            } ${!userCanManageData || !isLessonEditable ? 'cursor-not-allowed opacity-60' : ''}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateAttendance(student.id, 'status', 'EXCUSED')}
                            disabled={!userCanManageData || !isLessonEditable}
                            className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${
                              currentStatus === 'EXCUSED'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-400'
                            } ${!userCanManageData || !isLessonEditable ? 'cursor-not-allowed opacity-60' : ''}`}
                          >
                            <Shield className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConductRemovalClick(student.id, student.name)}
                            disabled={!userCanManageData || !isLessonEditable}
                            className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${
                              record?.conductRemoval
                                ? 'bg-orange-600 text-white'
                                : 'bg-gray-100 text-gray-400'
                            } ${!userCanManageData || !isLessonEditable ? 'cursor-not-allowed opacity-60' : ''}`}
                            title={record?.conductRemoval ? `Removed: ${record.conductNote}` : 'Remove from Lesson'}
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {!compactMode && (
                          <button
                            type="button"
                            onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                            className="p-0.5 text-gray-400 hover:text-gray-600 shrink-0"
                          >
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
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
                {userCanManageData && (
                  <Button
                    onClick={saveAttendance}
                    disabled={saving || !isLessonEditable}
                    size="lg"
                    className="px-8"
                  >
                    {saving ? 'Saving...' : !isLessonEditable ? 'Future Lesson' : 'Save Attendance'}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Conduct Removal Dialog */}
      <Dialog open={!!conductRemovalDialog} onOpenChange={(open) => { if (!open) setConductRemovalDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from Lesson</DialogTitle>
            <DialogDescription>
              {conductRemovalDialog && (
                <>
                  You are marking <strong>{conductRemovalDialog.studentName}</strong> as removed from this lesson.
                  This will count as an absence in their attendance record.
                  A reason is required.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="conduct-note">Reason for Removal <span className="text-red-500">*</span></Label>
            <Textarea
              id="conduct-note"
              placeholder="Describe the reason for removing this student from the lesson..."
              value={conductNoteInput}
              onChange={(e) => setConductNoteInput(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConductRemovalDialog(null)}>Cancel</Button>
            <Button
              onClick={confirmConductRemoval}
              disabled={!conductNoteInput.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Confirm Removal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Viewer Lightbox */}
      {viewingPhoto && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6"
          onClick={() => setViewingPhoto(null)}
        >
          <div className="relative max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={viewingPhoto.url}
              alt={viewingPhoto.name}
              className="w-full rounded-xl object-cover aspect-square"
            />
            <p className="text-center text-white text-sm font-medium mt-3">{viewingPhoto.name}</p>
            <button
              onClick={() => setViewingPhoto(null)}
              className="absolute -top-3 -right-3 bg-white dark:bg-gray-800 rounded-full p-1.5 shadow-lg text-gray-600 hover:text-gray-900 dark:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
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
    highlight === 'upcoming' ? 'bg-maroon-50 border-maroon-200' :
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
      {/* Desktop Layout */}
      <CardContent className="hidden sm:block p-4">
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
              <Badge className="bg-maroon-600">This Week</Badge>
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

      {/* Mobile Layout - Compact */}
      <CardContent className="sm:hidden p-2.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-sm">{formatDateUTC(lesson.scheduledDate, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              {attendanceCount > 0 && (
                <span className="text-xs text-green-600">• {attendanceCount}</span>
              )}
            </div>
            <div className="text-xs text-gray-500 truncate">
              L{lesson.lessonNumber}: {lesson.title}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {showYear && yearName && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 text-purple-700 border-purple-200">
                {yearName.replace('Academic Year ', '')}
              </Badge>
            )}
            <Badge className="text-[10px] px-1.5 py-0">{lesson.examSection.displayName}</Badge>
            {highlight === 'completed' && (
              <Badge className="text-[10px] px-1 py-0 bg-green-600">✓</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
