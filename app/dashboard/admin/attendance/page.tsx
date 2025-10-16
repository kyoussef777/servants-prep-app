'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { isAdmin } from '@/lib/roles'
import { ChevronDown, ChevronRight, Calendar, Users } from 'lucide-react'
import { toast } from 'sonner'

interface Lesson {
  id: string
  title: string
  scheduledDate: string
  lessonNumber: number
  status: string
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
  const [attendance, setAttendance] = useState<Map<string, AttendanceRecord>>(new Map())
  const [existingAttendance, setExistingAttendance] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterYearLevel, setFilterYearLevel] = useState<string>('all')
  const [filterMentees, setFilterMentees] = useState(false)
  const [showPastLessons, setShowPastLessons] = useState(false)
  const [showCompletedLessons, setShowCompletedLessons] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role && !isAdmin(session.user.role)) {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const yearsRes = await fetch('/api/academic-years')
        if (!yearsRes.ok) {
          // Silently handle - set empty data
          setStudents([])
          setLessons([])
          setLoading(false)
          return
        }

        const years = await yearsRes.json()
        if (!Array.isArray(years)) {
          setStudents([])
          setLessons([])
          setLoading(false)
          return
        }

        const activeYear = years.find((y: any) => y.isActive)

        if (activeYear) {
          const lessonsRes = await fetch(`/api/lessons?academicYearId=${activeYear.id}`)
          if (!lessonsRes.ok) {
            setLessons([])
          } else {
            const lessonsData = await lessonsRes.json()
            setLessons(Array.isArray(lessonsData) ? lessonsData : [])
          }

          const enrollmentsRes = await fetch('/api/enrollments')
          if (!enrollmentsRes.ok) {
            setStudents([])
          } else {
            const enrollmentsData = await enrollmentsRes.json()

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
          }
        }
      } catch (error) {
        // Silently handle errors - just set empty data
        setStudents([])
        setLessons([])
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchData()
    }
  }, [session])

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
  }

  const saveAttendance = async () => {
    if (!selectedLesson) return

    setSaving(true)
    try {
      // Save attendance for all filtered students (not just marked ones)
      for (const student of filteredStudents) {
        const record = attendance.get(student.id)
        const existingRecord = existingAttendance.get(student.id)

        // Default to ABSENT if not marked
        const status = record?.status || 'ABSENT'

        if (existingRecord) {
          await fetch(`/api/attendance/${existingRecord.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: status,
              arrivedAt: record?.arrivedAt || null,
              notes: record?.notes || null,
            })
          })
        } else {
          await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lessonId: selectedLesson.id,
              studentId: student.id,
              status: status,
              arrivedAt: record?.arrivedAt || null,
              notes: record?.notes || null,
            })
          })
        }
      }

      const now = new Date()
      setLastSaved(now)
      toast.success('Attendance saved successfully!', {
        description: now.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      })
      setSelectedLesson(null)
    } catch (error) {
      console.error('Failed to save attendance:', error)
      toast.error('Failed to save attendance', {
        description: 'Please try again.'
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

  // Categorize lessons
  const now = new Date()
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const upcomingLessons = lessons.filter(l => {
    const date = new Date(l.scheduledDate)
    return date >= now && date <= oneWeekFromNow
  })

  const futureLessons = lessons.filter(l => {
    const date = new Date(l.scheduledDate)
    return date > oneWeekFromNow
  })

  const recentPastLessons = lessons.filter(l => {
    const date = new Date(l.scheduledDate)
    return date < now && date >= oneWeekAgo
  })

  const olderPastLessons = lessons.filter(l => {
    const date = new Date(l.scheduledDate)
    return date < oneWeekAgo
  })

  const completedLessons = lessons.filter(l =>
    l.status === 'COMPLETED' && (l._count?.attendanceRecords || 0) > 0
  )

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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Take Attendance</h1>
            <p className="text-sm text-gray-600">Mark student attendance for lessons</p>
          </div>
          {selectedLesson && (
            <Button variant="outline" onClick={() => setSelectedLesson(null)}>
              Change Lesson
            </Button>
          )}
        </div>

        {/* Lesson Selection */}
        {!selectedLesson ? (
          <div className="space-y-4">
            {/* Upcoming Lessons (This Week) */}
            {upcomingLessons.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Upcoming This Week
                </h2>
                <div className="grid gap-2">
                  {upcomingLessons.map(lesson => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      onClick={() => setSelectedLesson(lesson)}
                      highlight="upcoming"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Past Lessons (Last 7 days) */}
            {recentPastLessons.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-600" />
                  Recent Past (Last 7 Days)
                </h2>
                <div className="grid gap-2">
                  {recentPastLessons.map(lesson => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      onClick={() => setSelectedLesson(lesson)}
                      highlight="recent"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Future Lessons (More than 1 week away) */}
            {futureLessons.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-600" />
                  Future Lessons
                </h2>
                <div className="grid gap-2">
                  {futureLessons.slice(0, 3).map(lesson => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      onClick={() => setSelectedLesson(lesson)}
                    />
                  ))}
                  {futureLessons.length > 3 && (
                    <p className="text-sm text-gray-500 pl-2">
                      +{futureLessons.length - 3} more future lessons
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Completed Lessons (Collapsible) */}
            {completedLessons.length > 0 && (
              <div>
                <button
                  onClick={() => setShowCompletedLessons(!showCompletedLessons)}
                  className="flex items-center gap-2 text-lg font-semibold mb-2 hover:text-gray-700"
                >
                  {showCompletedLessons ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  <Users className="w-5 h-5 text-green-600" />
                  Completed Lessons ({completedLessons.length})
                </button>
                {showCompletedLessons && (
                  <div className="grid gap-2">
                    {completedLessons.map(lesson => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        onClick={() => setSelectedLesson(lesson)}
                        highlight="completed"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Older Past Lessons (Collapsible) */}
            {olderPastLessons.length > 0 && (
              <div>
                <button
                  onClick={() => setShowPastLessons(!showPastLessons)}
                  className="flex items-center gap-2 text-lg font-semibold mb-2 hover:text-gray-700"
                >
                  {showPastLessons ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  <Calendar className="w-5 h-5 text-gray-400" />
                  Older Past Lessons ({olderPastLessons.length})
                </button>
                {showPastLessons && (
                  <div className="grid gap-2">
                    {olderPastLessons.map(lesson => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        onClick={() => setSelectedLesson(lesson)}
                        highlight="past"
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
                    <div className="text-sm text-gray-600">
                      {new Date(selectedLesson.scheduledDate).toLocaleDateString()} | {selectedLesson.examSection.displayName}
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
                onClick={saveAttendance}
                disabled={saving}
                size="sm"
                className="ml-auto"
              >
                {saving ? 'Saving...' : 'Save Attendance'}
              </Button>
            </div>

            {lastSaved && (
              <p className="text-xs text-gray-500 mt-2">
                Last saved {lastSaved.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </p>
            )}

            {/* Excel-like Table - Desktop */}
            <Card className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-2 font-medium text-gray-700 w-8">#</th>
                      <th className="text-left p-2 font-medium text-gray-700">Name</th>
                      <th className="text-center p-2 font-medium text-gray-700 w-20">Year</th>
                      <th className="text-center p-2 font-medium text-gray-700 w-24">Present</th>
                      <th className="text-center p-2 font-medium text-gray-700 w-24">Late</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-32">Arrived</th>
                      <th className="text-left p-2 font-medium text-gray-700">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student, index) => {
                      const record = attendance.get(student.id)
                      const yearBadge = student.enrollments[0]?.yearLevel === 'YEAR_1' ? 'Y1' : 'Y2'

                      return (
                        <tr key={student.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-gray-500">{index + 1}</td>
                          <td className="p-2 font-medium">{student.name}</td>
                          <td className="p-2 text-center">
                            <Badge variant="outline" className="text-xs">
                              {yearBadge}
                            </Badge>
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={record?.status === 'PRESENT'}
                              onChange={(e) => updateAttendance(student.id, 'status', e.target.checked ? 'PRESENT' : 'ABSENT')}
                              className="h-4 w-4 cursor-pointer"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={record?.status === 'LATE'}
                              onChange={(e) => updateAttendance(student.id, 'status', e.target.checked ? 'LATE' : 'ABSENT')}
                              className="h-4 w-4 cursor-pointer"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="time"
                              value={record?.arrivedAt || ''}
                              onChange={(e) => updateAttendance(student.id, 'arrivedAt', e.target.value)}
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="text"
                              placeholder="Notes..."
                              value={record?.notes || ''}
                              onChange={(e) => updateAttendance(student.id, 'notes', e.target.value)}
                              className="h-8 text-xs"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-3">
              {filteredStudents.map((student, index) => {
                const record = attendance.get(student.id)
                const yearLevel = student.enrollments[0]?.yearLevel

                return (
                  <Card key={student.id}>
                    <CardContent className="p-4 space-y-3">
                      {/* Student Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">#{index + 1}</span>
                            <h3 className="font-semibold">{student.name}</h3>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {yearLevel === 'YEAR_1' ? 'Year 1' : 'Year 2'}
                        </Badge>
                      </div>

                      {/* Status Selection */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Status</label>
                        <div className="flex gap-2">
                          <label className="flex-1 flex items-center justify-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                              type="radio"
                              name={`status-${student.id}`}
                              checked={record?.status === 'PRESENT'}
                              onChange={() => updateAttendance(student.id, 'status', 'PRESENT')}
                              className="h-4 w-4"
                            />
                            <span className="text-sm font-medium">Present</span>
                          </label>
                          <label className="flex-1 flex items-center justify-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                              type="radio"
                              name={`status-${student.id}`}
                              checked={record?.status === 'LATE'}
                              onChange={() => updateAttendance(student.id, 'status', 'LATE')}
                              className="h-4 w-4"
                            />
                            <span className="text-sm font-medium">Late</span>
                          </label>
                          <label className="flex-1 flex items-center justify-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                              type="radio"
                              name={`status-${student.id}`}
                              checked={!record?.status || record?.status === 'ABSENT'}
                              onChange={() => updateAttendance(student.id, 'status', 'ABSENT')}
                              className="h-4 w-4"
                            />
                            <span className="text-sm font-medium">Absent</span>
                          </label>
                        </div>
                      </div>

                      {/* Arrival Time */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Arrival Time (Optional)</label>
                        <Input
                          type="time"
                          value={record?.arrivedAt || ''}
                          onChange={(e) => updateAttendance(student.id, 'arrivedAt', e.target.value)}
                          className="w-full"
                        />
                      </div>

                      {/* Notes */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Notes (Optional)</label>
                        <Input
                          type="text"
                          placeholder="Add notes..."
                          value={record?.notes || ''}
                          onChange={(e) => updateAttendance(student.id, 'notes', e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
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
  highlight
}: {
  lesson: Lesson
  onClick: () => void
  highlight?: 'upcoming' | 'recent' | 'past' | 'completed'
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
              {new Date(lesson.scheduledDate).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
              {attendanceCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  {attendanceCount} attended
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
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
