'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Edit, Check, X, Trash2, Send } from 'lucide-react'
import { UserRole } from '@prisma/client'
import { getRoleDisplayName } from '@/lib/roles'
import { formatDateUTC } from '@/lib/utils'

interface StudentNote {
  id: string
  content: string
  createdAt: string | Date
  updatedAt: string | Date
  author: {
    id: string
    name: string
    role: UserRole
  }
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
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'
  arrivedAt?: string | Date
  notes?: string
  lesson: {
    id: string
    title: string
    scheduledDate: string | Date
    isExamDay?: boolean
    examSection: {
      id: string
      name: string
      displayName: string
      yearLevel: string
    }
    academicYear?: {
      id: string
      name: string
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

interface Mentor {
  id: string
  name: string
  email?: string
}

interface FatherOfConfession {
  id: string
  name: string
  phone?: string
  church?: string
}

interface StudentDetailsModalProps {
  studentId: string | null
  studentName: string
  studentEmail?: string
  studentPhone?: string
  yearLevel?: string
  mentor?: Mentor | null
  fatherOfConfession?: FatherOfConfession | null
  enrollmentId?: string
  examScores: ExamScore[]
  attendanceRecords: AttendanceRecord[]
  allExams?: Exam[]
  allLessons?: Lesson[]
  loading: boolean
  onClose: () => void
  onRefresh: () => void
}

export function StudentDetailsModal({
  studentId,
  studentName,
  studentEmail = '',
  studentPhone = '',
  yearLevel,
  mentor,
  fatherOfConfession,
  enrollmentId,
  examScores,
  attendanceRecords,
  allExams = [],
  loading,
  onClose,
  onRefresh
}: StudentDetailsModalProps) {
  const { data: session } = useSession()
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null)
  const [editingScore, setEditingScore] = useState<number>(0)
  const [editingScoreNotes, setEditingScoreNotes] = useState<string>('')
  const [editingAttendanceId, setEditingAttendanceId] = useState<string | null>(null)

  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState(studentName)
  const [profileEmail, setProfileEmail] = useState(studentEmail)
  const [profilePhone, setProfilePhone] = useState(studentPhone)
  const [savingProfile, setSavingProfile] = useState(false)

  // Notes state
  const [notes, setNotes] = useState<StudentNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteContent, setEditingNoteContent] = useState('')

  // Father of Confession state
  const [fathersList, setFathersList] = useState<FatherOfConfession[]>([])
  const [selectedFatherId, setSelectedFatherId] = useState<string>('')
  const [savingFather, setSavingFather] = useState(false)

  // Fetch notes when student changes
  useEffect(() => {
    if (studentId) {
      fetchNotes()
      fetchFathersList()
    } else {
      setNotes([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  // Update selectedFatherId when fatherOfConfession prop changes
  useEffect(() => {
    setSelectedFatherId(fatherOfConfession?.id || '')
  }, [fatherOfConfession])

  const fetchNotes = async () => {
    if (!studentId) return
    setNotesLoading(true)
    try {
      const res = await fetch(`/api/students/${studentId}/notes`)
      if (res.ok) {
        const data = await res.json()
        setNotes(data)
      }
    } catch (error) {
      console.error('Failed to fetch notes:', error)
    } finally {
      setNotesLoading(false)
    }
  }

  const fetchFathersList = async () => {
    try {
      const res = await fetch('/api/fathers-of-confession')
      if (res.ok) {
        const data = await res.json()
        setFathersList(data)
      }
    } catch (error) {
      console.error('Failed to fetch fathers of confession:', error)
    }
  }

  const updateFatherOfConfession = async (fatherId: string) => {
    if (!enrollmentId) {
      toast.error('No enrollment found for this student')
      return
    }
    setSavingFather(true)
    try {
      const res = await fetch(`/api/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fatherOfConfessionId: fatherId || null
        })
      })

      if (res.ok) {
        toast.success('Father of Confession updated successfully!')
        setSelectedFatherId(fatherId)
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update Father of Confession')
      }
    } catch (error) {
      console.error('Failed to update Father of Confession:', error)
      toast.error('Failed to update Father of Confession')
    } finally {
      setSavingFather(false)
    }
  }

  const addNote = async () => {
    if (!studentId || !newNoteContent.trim()) return
    setSubmittingNote(true)
    try {
      const res = await fetch(`/api/students/${studentId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent.trim() })
      })
      if (res.ok) {
        const note = await res.json()
        setNotes([note, ...notes])
        setNewNoteContent('')
        toast.success('Note added successfully!')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to add note')
      }
    } catch (error) {
      console.error('Failed to add note:', error)
      toast.error('Failed to add note')
    } finally {
      setSubmittingNote(false)
    }
  }

  const updateNote = async (noteId: string) => {
    if (!editingNoteContent.trim()) return
    try {
      const res = await fetch(`/api/student-notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingNoteContent.trim() })
      })
      if (res.ok) {
        const updatedNote = await res.json()
        setNotes(notes.map(n => n.id === noteId ? updatedNote : n))
        setEditingNoteId(null)
        setEditingNoteContent('')
        toast.success('Note updated successfully!')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update note')
      }
    } catch (error) {
      console.error('Failed to update note:', error)
      toast.error('Failed to update note')
    }
  }

  const deleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return
    try {
      const res = await fetch(`/api/student-notes/${noteId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setNotes(notes.filter(n => n.id !== noteId))
        toast.success('Note deleted successfully!')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete note')
      }
    } catch (error) {
      console.error('Failed to delete note:', error)
      toast.error('Failed to delete note')
    }
  }

  // Reset profile form when student changes
  const resetProfileForm = () => {
    setProfileName(studentName)
    setProfileEmail(studentEmail)
    setProfilePhone(studentPhone)
    setEditingProfile(false)
  }

  const updateStudentProfile = async () => {
    if (!studentId) return
    setSavingProfile(true)
    try {
      const res = await fetch(`/api/users/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName,
          email: profileEmail,
          phone: profilePhone || null
        })
      })

      if (res.ok) {
        toast.success('Student profile updated successfully!')
        setEditingProfile(false)
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Failed to update profile:', error)
      toast.error('Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const updateExamScore = async (scoreId: string, newScore: number, notes?: string) => {
    try {
      const res = await fetch(`/api/exam-scores/${scoreId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: newScore, notes: notes || null })
      })

      if (res.ok) {
        toast.success('Score updated successfully!')
        onRefresh()
      } else {
        toast.error('Failed to update score')
      }
    } catch (error) {
      console.error('Failed to update score:', error)
      toast.error('Failed to update score')
    }
    setEditingScoreId(null)
  }

  const updateAttendance = async (recordId: string, status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED') => {
    try {
      const res = await fetch(`/api/attendance/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      if (res.ok) {
        toast.success('Attendance updated successfully!')
        onRefresh()
      } else {
        toast.error('Failed to update attendance')
      }
    } catch (error) {
      console.error('Failed to update attendance:', error)
      toast.error('Failed to update attendance')
    }
    setEditingAttendanceId(null)
  }

  // Calculate average score
  const avgScore = examScores.length > 0
    ? examScores.reduce((sum, s) => sum + s.percentage, 0) / examScores.length
    : 0

  // Group scores by section (using displayName for better readability)
  const scoresBySection = examScores.reduce((acc, score) => {
    const section = score.exam.examSection.displayName || score.exam.examSection.name
    if (!acc[section]) acc[section] = []
    acc[section].push(score)
    return acc
  }, {} as Record<string, ExamScore[]>)

  // Find missing exams (past exams student hasn't taken - exclude future exams)
  const now = new Date()
  const takenExamIds = new Set(examScores.map(s => s.exam.id))
  const missingExams = allExams.filter(exam =>
    !takenExamIds.has(exam.id) && new Date(exam.examDate) < now
  )

  // Filter out exam day lessons from attendance calculations (they don't count toward graduation)
  const countableAttendance = attendanceRecords.filter(r => !r.lesson.isExamDay)

  // Separate attendance by year level (using section yearLevel for grouping display)
  const year1Attendance = countableAttendance.filter(r =>
    r.lesson.examSection.yearLevel === 'YEAR_1'
  )
  const year2Attendance = countableAttendance.filter(r =>
    r.lesson.examSection.yearLevel === 'YEAR_2'
  )

  // Calculate attendance stats using Formula A: (Present + Late/2) / (Total - Excused) * 100
  const presentCount = countableAttendance.filter(r => r.status === 'PRESENT').length
  const lateCount = countableAttendance.filter(r => r.status === 'LATE').length
  const absentCount = countableAttendance.filter(r => r.status === 'ABSENT').length
  const excusedCount = countableAttendance.filter(r => r.status === 'EXCUSED').length
  const effectiveTotal = countableAttendance.length - excusedCount
  const attendanceRate = effectiveTotal > 0
    ? ((presentCount + (lateCount / 2)) / effectiveTotal) * 100
    : 0

  // Year 1 attendance stats
  const year1Present = year1Attendance.filter(r => r.status === 'PRESENT').length
  const year1Late = year1Attendance.filter(r => r.status === 'LATE').length
  const year1Absent = year1Attendance.filter(r => r.status === 'ABSENT').length
  const year1Excused = year1Attendance.filter(r => r.status === 'EXCUSED').length
  const year1EffectiveTotal = year1Attendance.length - year1Excused
  const year1Rate = year1EffectiveTotal > 0
    ? ((year1Present + (year1Late / 2)) / year1EffectiveTotal) * 100
    : 0

  // Year 2 attendance stats
  const year2Present = year2Attendance.filter(r => r.status === 'PRESENT').length
  const year2Late = year2Attendance.filter(r => r.status === 'LATE').length
  const year2Absent = year2Attendance.filter(r => r.status === 'ABSENT').length
  const year2Excused = year2Attendance.filter(r => r.status === 'EXCUSED').length
  const year2EffectiveTotal = year2Attendance.length - year2Excused
  const year2Rate = year2EffectiveTotal > 0
    ? ((year2Present + (year2Late / 2)) / year2EffectiveTotal) * 100
    : 0

  return (
    <Dialog open={!!studentId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>{studentName} - Details</span>
            <div className="flex items-center gap-2 text-sm font-normal">
              {yearLevel && (
                <Badge variant="outline">{yearLevel === 'YEAR_1' ? 'Year 1' : 'Year 2'}</Badge>
              )}
              {mentor && (
                <div className="text-gray-600">
                  Mentor: <span className="font-medium">{mentor.name}</span>
                </div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading...</div>
        ) : (
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="scores">Exams</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Student Information</h3>
                    {!editingProfile ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setProfileName(studentName)
                          setProfileEmail(studentEmail)
                          setProfilePhone(studentPhone)
                          setEditingProfile(true)
                        }}
                        className="gap-1"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={resetProfileForm}
                          disabled={savingProfile}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={updateStudentProfile}
                          disabled={savingProfile}
                          className="gap-1"
                        >
                          <Check className="h-4 w-4" />
                          {savingProfile ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {editingProfile ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Full Name</label>
                        <Input
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="Full Name"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Email</label>
                        <Input
                          type="email"
                          value={profileEmail}
                          onChange={(e) => setProfileEmail(e.target.value)}
                          placeholder="Email"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Phone (optional)</label>
                        <Input
                          type="tel"
                          value={profilePhone}
                          onChange={(e) => setProfilePhone(e.target.value)}
                          placeholder="Phone number"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Name</span>
                        <span className="font-medium">{studentName}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Email</span>
                        <span className="font-medium">{studentEmail || '-'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Phone</span>
                        <span className="font-medium">{studentPhone || '-'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Year Level</span>
                        <span className="font-medium">
                          {yearLevel === 'YEAR_1' ? 'Year 1' : yearLevel === 'YEAR_2' ? 'Year 2' : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Mentor</span>
                        <span className="font-medium">{mentor?.name || 'Not assigned'}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 gap-1 sm:gap-2">
                        <span className="text-gray-600 shrink-0">Father of Confession</span>
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedFatherId}
                            onChange={(e) => updateFatherOfConfession(e.target.value)}
                            disabled={savingFather || !enrollmentId}
                            className="border rounded px-2 py-1 text-sm w-full sm:w-auto sm:max-w-[180px] truncate"
                          >
                            <option value="">Not assigned</option>
                            {fathersList.map((father) => (
                              <option key={father.id} value={father.id}>
                                {father.name}
                              </option>
                            ))}
                          </select>
                          {savingFather && <span className="text-xs text-gray-500">Saving...</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              {/* Add New Note */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3">Add a Note</h3>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Write a note about this student..."
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="flex-1"
                      rows={2}
                    />
                    <Button
                      onClick={addNote}
                      disabled={submittingNote || !newNoteContent.trim()}
                      className="self-end"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Notes List */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3">
                    Comments ({notes.length})
                  </h3>
                  {notesLoading ? (
                    <div className="py-4 text-center text-gray-500">Loading notes...</div>
                  ) : notes.length === 0 ? (
                    <div className="py-4 text-center text-gray-500">No notes yet. Add the first one!</div>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {notes.map((note) => {
                        const isAuthor = session?.user?.id === note.author.id
                        const isEditing = editingNoteId === note.id

                        return (
                          <div key={note.id} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm">{note.author.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {getRoleDisplayName(note.author.role)}
                                  </Badge>
                                  <span className="text-xs text-gray-500">
                                    {new Date(note.createdAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <Textarea
                                      value={editingNoteContent}
                                      onChange={(e) => setEditingNoteContent(e.target.value)}
                                      className="text-sm"
                                      rows={2}
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => updateNote(note.id)}
                                        disabled={!editingNoteContent.trim()}
                                      >
                                        <Check className="h-3 w-3 mr-1" />
                                        Save
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEditingNoteId(null)
                                          setEditingNoteContent('')
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                                )}
                              </div>
                              {!isEditing && (isAuthor || session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'PRIEST' || session?.user?.role === 'SERVANT_PREP') && (
                                <div className="flex gap-1">
                                  {isAuthor && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingNoteId(note.id)
                                        setEditingNoteContent(note.content)
                                      }}
                                      className="h-7 w-7 p-0"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteNote(note.id)}
                                    className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scores" className="space-y-4">
              {/* Score Summary */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">Average Score</div>
                      <div className={`text-2xl font-bold ${avgScore >= 75 ? 'text-green-700' : avgScore >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
                        {avgScore.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Exams Taken</div>
                      <div className="text-2xl font-bold">{examScores.length}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Scores by Section */}
              {Object.keys(scoresBySection).length === 0 ? (
                <div className="text-center py-8 text-gray-500">No exam scores yet</div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(scoresBySection).map(([section, scores]) => (
                    <Card key={section}>
                      <CardContent className="pt-4">
                        <h3 className="font-semibold mb-3">{section}</h3>
                        <div className="space-y-2">
                          {scores.map((score) => (
                            <div key={score.id} className="p-2 bg-gray-50 rounded">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-medium text-sm">
                                    {score.exam.examSection.displayName} Exam
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {formatDateUTC(score.exam.examDate, {
                                      weekday: undefined,
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                    {score.grader && ` • Graded by ${score.grader.name}`}
                                  </div>
                                  {!editingScoreId && score.notes && (
                                    <div className="text-xs text-gray-600 mt-1 italic">{score.notes}</div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {editingScoreId === score.id ? (
                                    <>
                                      <Input
                                        type="number"
                                        value={isNaN(editingScore) ? '' : editingScore}
                                        onChange={(e) => {
                                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value)
                                          setEditingScore(isNaN(val) ? 0 : val)
                                        }}
                                        className="w-20 h-8 text-sm"
                                        max={score.exam.totalPoints}
                                        min={0}
                                      />
                                      <span className="text-sm text-gray-500">/ {score.exam.totalPoints}</span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => updateExamScore(score.id, editingScore, editingScoreNotes)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Check className="h-4 w-4 text-green-600" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditingScoreId(null)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <X className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <div className="text-right">
                                        <div className={`font-semibold ${score.percentage >= 75 ? 'text-green-700' : score.percentage >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
                                          {score.percentage.toFixed(2)}%
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {score.score} / {score.exam.totalPoints}
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingScoreId(score.id)
                                          setEditingScore(score.score)
                                          setEditingScoreNotes(score.notes || '')
                                        }}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                              {editingScoreId === score.id && (
                                <div className="mt-2">
                                  <Textarea
                                    placeholder="Notes (optional)"
                                    value={editingScoreNotes}
                                    onChange={(e) => setEditingScoreNotes(e.target.value)}
                                    className="text-sm"
                                    rows={2}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Missing Exams */}
              {missingExams.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <h3 className="font-semibold mb-3 text-amber-700">Missing Exams ({missingExams.length})</h3>
                    <div className="space-y-2">
                      {missingExams.map((exam) => (
                        <div key={exam.id} className="p-2 bg-amber-50 rounded border border-amber-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-sm">{exam.examSection.displayName}</div>
                              <div className="text-xs text-gray-500">
                                {formatDateUTC(exam.examDate, {
                                  weekday: undefined,
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                                {' • '}
                                Out of {exam.totalPoints} points
                              </div>
                            </div>
                            <Badge variant="outline" className="text-amber-700 border-amber-700">
                              Not Taken
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="attendance" className="space-y-4">
              {/* Attendance Summary - Overall */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3">Overall Attendance</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">Rate</div>
                      <div className={`text-2xl font-bold ${attendanceRate >= 75 ? 'text-green-700' : attendanceRate >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
                        {attendanceRate.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Present</div>
                      <div className="text-2xl font-bold text-green-700">{presentCount}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Late</div>
                      <div className="text-2xl font-bold text-yellow-700">{lateCount}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Absent</div>
                      <div className="text-2xl font-bold text-red-700">{absentCount}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Excused</div>
                      <div className="text-2xl font-bold text-blue-700">{excusedCount}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Year 1 Attendance */}
              {year1Attendance.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-3">Year 1 Attendance</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">Rate</div>
                        <div className={`text-2xl font-bold ${year1Rate >= 75 ? 'text-green-700' : year1Rate >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
                          {year1Rate.toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Present</div>
                        <div className="text-2xl font-bold text-green-700">{year1Present}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Late</div>
                        <div className="text-2xl font-bold text-yellow-700">{year1Late}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Absent</div>
                        <div className="text-2xl font-bold text-red-700">{year1Absent}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Excused</div>
                        <div className="text-2xl font-bold text-blue-700">{year1Excused}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Year 2 Attendance */}
              {year2Attendance.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-3">Year 2 Attendance</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">Rate</div>
                        <div className={`text-2xl font-bold ${year2Rate >= 75 ? 'text-green-700' : year2Rate >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
                          {year2Rate.toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Present</div>
                        <div className="text-2xl font-bold text-green-700">{year2Present}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Late</div>
                        <div className="text-2xl font-bold text-yellow-700">{year2Late}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Absent</div>
                        <div className="text-2xl font-bold text-red-700">{year2Absent}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Excused</div>
                        <div className="text-2xl font-bold text-blue-700">{year2Excused}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Attendance Records */}
              {attendanceRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No attendance records yet</div>
              ) : (
                <div className="space-y-2">
                  {attendanceRecords.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="font-medium text-sm flex items-center gap-2">
                          {formatDateUTC(record.lesson.scheduledDate, {
                            weekday: undefined,
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal bg-blue-50 text-blue-700 border-blue-200">
                            {record.lesson.examSection.displayName}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500">
                          {record.lesson.title}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingAttendanceId === record.id ? (
                          <>
                            <select
                              value={record.status}
                              onChange={(e) => updateAttendance(record.id, e.target.value as 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED')}
                              className="border rounded px-2 py-1 text-sm"
                            >
                              <option value="PRESENT">Present</option>
                              <option value="LATE">Late</option>
                              <option value="ABSENT">Absent</option>
                              <option value="EXCUSED">Excused</option>
                            </select>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingAttendanceId(null)}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {record.status === 'PRESENT' && (
                              <Badge className="bg-green-100 text-green-800">Present</Badge>
                            )}
                            {record.status === 'LATE' && (
                              <Badge className="bg-yellow-100 text-yellow-800">Late</Badge>
                            )}
                            {record.status === 'ABSENT' && (
                              <Badge className="bg-red-100 text-red-800">Absent</Badge>
                            )}
                            {record.status === 'EXCUSED' && (
                              <Badge className="bg-blue-100 text-blue-800">Excused</Badge>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingAttendanceId(record.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
