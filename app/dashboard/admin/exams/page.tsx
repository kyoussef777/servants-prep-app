'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { isAdmin, canManageExams } from "@/lib/roles"
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { formatDateUTC } from '@/lib/utils'

interface AcademicYear {
  id: string
  name: string
  isActive: boolean
}

interface ExamSection {
  id: string
  name: string
  displayName: string
  passingScore: number
  averageRequirement: number
}

interface Exam {
  id: string
  examDate: string
  yearLevel: string
  totalPoints: number
  examSection: ExamSection
  _count: {
    scores: number
  }
}

interface Student {
  id: string
  name: string
  email: string
  enrollments: Array<{
    yearLevel: string
    mentorId: string | null
  }>
}

interface ExamScore {
  id: string
  score: number
  percentage: number
  notes?: string
  student: {
    id: string
    name: string
  }
}

export default function ExamsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [exams, setExams] = useState<Exam[]>([])
  const [examSections, setExamSections] = useState<ExamSection[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [selectedYearId, setSelectedYearId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showCreateExam, setShowCreateExam] = useState(false)
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [existingScores, setExistingScores] = useState<Map<string, ExamScore>>(new Map())
  const [scores, setScores] = useState<Map<string, number>>(new Map())
  const [notes, setNotes] = useState<Map<string, string>>(new Map())
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMentees, setFilterMentees] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // New exam form
  const [newExam, setNewExam] = useState({
    examSectionId: '',
    yearLevel: 'BOTH' as 'YEAR_1' | 'YEAR_2' | 'BOTH',
    examDate: '',
    totalPoints: 100
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role && !isAdmin(session.user.role)) {
      router.push('/dashboard')
    }
  }, [status, session, router])

  // Fetch academic years, sections, and enrollments on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [yearsRes, sectionsRes, enrollmentsRes] = await Promise.all([
          fetch('/api/academic-years'),
          fetch('/api/exam-sections'),
          fetch('/api/enrollments')
        ])

        if (!yearsRes.ok) throw new Error('Failed to fetch years')
        if (!sectionsRes.ok) throw new Error('Failed to fetch sections')
        if (!enrollmentsRes.ok) throw new Error('Failed to fetch enrollments')

        const [yearsData, sectionsData, enrollmentsData] = await Promise.all([
          yearsRes.json(),
          sectionsRes.json(),
          enrollmentsRes.json()
        ])

        const years = Array.isArray(yearsData) ? yearsData : []
        setAcademicYears(years)
        setExamSections(Array.isArray(sectionsData) ? sectionsData : [])

        // Default to "all" to show all exams
        setSelectedYearId('all')

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
        setStudents(Array.from(studentMap.values()))
      } catch (error) {
        console.error('Failed to fetch initial data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchInitialData()
    }
  }, [session])

  // Fetch exams when selected year changes
  useEffect(() => {
    const fetchExams = async () => {
      try {
        // If "all" is selected or no year selected, fetch all exams
        const url = selectedYearId && selectedYearId !== 'all'
          ? `/api/exams?academicYearId=${selectedYearId}`
          : '/api/exams'
        const examsRes = await fetch(url)
        if (!examsRes.ok) throw new Error('Failed to fetch exams')
        const examsData = await examsRes.json()
        setExams(Array.isArray(examsData) ? examsData : [])
      } catch (error) {
        console.error('Failed to fetch exams:', error)
        setExams([])
      }
    }

    fetchExams()
  }, [selectedYearId])

  const createExam = async () => {
    try {
      // When creating, use the selected year or default to active year
      let yearIdForCreate = selectedYearId
      if (!selectedYearId || selectedYearId === 'all') {
        const activeYear = academicYears.find(y => y.isActive)
        if (!activeYear) {
          toast.error('No active academic year found. Please select a year.')
          return
        }
        yearIdForCreate = activeYear.id
      }

      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicYearId: yearIdForCreate,
          ...newExam
        })
      })

      if (res.ok) {
        const exam = await res.json()
        setExams([exam, ...exams])
        setShowCreateExam(false)
        setNewExam({
          examSectionId: '',
          yearLevel: 'BOTH',
          examDate: '',
          totalPoints: 100
        })
        const now = new Date()
        setLastSaved(now)
        toast.success('Exam created successfully!', {
          description: now.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          })
        })
      } else {
        toast.error('Failed to create exam')
      }
    } catch (error) {
      console.error('Failed to create exam:', error)
      toast.error('Failed to create exam')
    }
  }

  const openEnterScores = async (exam: Exam) => {
    setSelectedExam(exam)
    setSearchTerm('')
    setFilterMentees(false)

    try {
      const res = await fetch(`/api/exams/${exam.id}/scores`)
      const scoresData = await res.json()

      const scoresMap = new Map()
      const enteredScoresMap = new Map()
      const notesMap = new Map()

      scoresData.forEach((score: ExamScore) => {
        scoresMap.set(score.student.id, score)
        enteredScoresMap.set(score.student.id, score.score)
        if (score.notes) {
          notesMap.set(score.student.id, score.notes)
        }
      })

      setExistingScores(scoresMap)
      setScores(enteredScoresMap)
      setNotes(notesMap)
    } catch (error) {
      console.error('Failed to fetch scores:', error)
    }
  }

  const handleScoreChange = (studentId: string, value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0 && numValue <= (selectedExam?.totalPoints || 100)) {
      setScores(prev => {
        const newMap = new Map(prev)
        newMap.set(studentId, numValue)
        return newMap
      })
    } else if (value === '') {
      setScores(prev => {
        const newMap = new Map(prev)
        newMap.delete(studentId)
        return newMap
      })
    }
  }

  const handleNotesChange = (studentId: string, value: string) => {
    setNotes(prev => {
      const newMap = new Map(prev)
      if (value.trim()) {
        newMap.set(studentId, value)
      } else {
        newMap.delete(studentId)
      }
      return newMap
    })
  }

  const saveScores = async () => {
    if (!selectedExam) return

    setSaving(true)
    try {
      // Batch all score updates/creates in parallel
      const scorePromises = Array.from(scores.entries()).map(([studentId, score]) => {
        const existingScore = existingScores.get(studentId)
        const studentNotes = notes.get(studentId) || null

        if (existingScore) {
          return fetch(`/api/exam-scores/${existingScore.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score, notes: studentNotes })
          })
        } else {
          return fetch(`/api/exams/${selectedExam.id}/scores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, score, notes: studentNotes })
          })
        }
      })

      await Promise.all(scorePromises)

      const now = new Date()
      setLastSaved(now)
      toast.success('Scores saved successfully!', {
        description: now.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      })

      // Refresh all score state from the server to ensure consistency
      const scoresRes = await fetch(`/api/exams/${selectedExam.id}/scores`)
      const scoresData = await scoresRes.json()

      const existingScoresMap = new Map()
      const enteredScoresMap = new Map()
      const notesMap = new Map()

      scoresData.forEach((score: ExamScore) => {
        existingScoresMap.set(score.student.id, score)
        enteredScoresMap.set(score.student.id, score.score)
        if (score.notes) {
          notesMap.set(score.student.id, score.notes)
        }
      })

      setExistingScores(existingScoresMap)
      setScores(enteredScoresMap)
      setNotes(notesMap)

      // Update exam count locally without full refetch
      setExams(exams.map(exam =>
        exam.id === selectedExam.id
          ? { ...exam, _count: { scores: scoresData.length } }
          : exam
      ))
    } catch (error) {
      console.error('Failed to save scores:', error)
      toast.error('Failed to save scores')
    } finally {
      setSaving(false)
    }
  }

  const deleteExam = async (examId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent opening the exam for scoring

    if (!confirm('Are you sure you want to delete this exam? This will also delete all associated scores.')) {
      return
    }

    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || 'Failed to delete exam')
        return
      }

      toast.success('Exam deleted successfully!')

      // Remove the deleted exam from state
      setExams(exams.filter(exam => exam.id !== examId))
    } catch (error) {
      console.error('Failed to delete exam:', error)
      toast.error('Failed to delete exam')
    }
  }

  const eligibleStudents = students.filter(student => {
    if (!selectedExam) return false

    const yearLevel = student.enrollments[0]?.yearLevel

    if (selectedExam.yearLevel === 'BOTH') return true
    if (selectedExam.yearLevel === yearLevel) return true

    return false
  })

  const filteredStudents = eligibleStudents.filter(student => {
    if (searchTerm && !student.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }

    if (filterMentees && session?.user?.id) {
      if (!student.enrollments.some(e => e.mentorId === session.user.id)) {
        return false
      }
    }

    return true
  })

  // PRIEST is read-only, only SUPER_ADMIN and SERVANT_PREP can manage exams
  const canEdit = session?.user?.role && canManageExams(session.user.role)

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
            <h1 className="text-2xl font-bold">Exam Management</h1>
            <p className="text-sm text-gray-600">Create exams and enter scores</p>
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
          <div className="flex items-center gap-3">
            {!selectedExam && (
              <>
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
                {canEdit && (
                  <Button onClick={() => setShowCreateExam(true)}>
                    Create New Exam
                  </Button>
                )}
              </>
            )}
            {selectedExam && (
              <Button variant="outline" onClick={() => setSelectedExam(null)}>
                Back to Exams
              </Button>
            )}
          </div>
        </div>

        {/* Exam List or Score Entry */}
        {!selectedExam ? (
          <div className="space-y-6">
            {examSections.map(section => {
              const sectionExams = exams.filter(e => e.examSection.name === section.name)

              return (
                <div key={section.id} className="space-y-3">
                  <h2 className="text-lg font-semibold">{section.displayName}</h2>

                  {sectionExams.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center text-sm text-gray-500">
                        No exams created yet
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-3">
                      {sectionExams.map(exam => (
                        <Card
                          key={exam.id}
                          className="cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => openEnterScores(exam)}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-semibold flex items-center gap-2">
                                  {section.displayName} Exam
                                  <Badge variant="outline">
                                    {exam.yearLevel === 'BOTH' ? 'All' : exam.yearLevel === 'YEAR_1' ? 'Y1' : 'Y2'}
                                  </Badge>
                                </div>
                                <div className="text-sm text-gray-600">
                                  {formatDateUTC(exam.examDate, { weekday: undefined })} | {exam.totalPoints} points
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-sm text-gray-600">
                                  {exam._count?.scores || 0} scores entered
                                </div>
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => deleteExam(exam.id, e)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <>
            {/* Selected Exam Info */}
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{selectedExam.examSection.displayName} Exam</div>
                    <div className="text-sm text-gray-600">
                      {formatDateUTC(selectedExam.examDate, { weekday: undefined })} | Out of {selectedExam.totalPoints} points
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {scores.size} / {filteredStudents.length} scores entered
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
              <label className="flex items-center gap-2 px-3 h-10 border rounded-md bg-background cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterMentees}
                  onChange={(e) => setFilterMentees(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm">My Mentees</span>
              </label>
              {canEdit && (
                <Button
                  onClick={saveScores}
                  disabled={saving || scores.size === 0}
                  size="sm"
                  className="ml-auto"
                >
                  {saving ? 'Saving...' : 'Save Scores'}
                </Button>
              )}
            </div>

            {/* Excel-like Table - Desktop */}
            <Card className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-2 font-medium text-gray-700 w-8">#</th>
                      <th className="text-left p-2 font-medium text-gray-700">Name</th>
                      <th className="text-center p-2 font-medium text-gray-700 w-20">Year</th>
                      <th className="text-center p-2 font-medium text-gray-700 w-32">Score</th>
                      <th className="text-center p-2 font-medium text-gray-700 w-24">Percentage</th>
                      <th className="text-center p-2 font-medium text-gray-700 w-24">Status</th>
                      <th className="text-left p-2 font-medium text-gray-700">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student, index) => {
                      const score = scores.get(student.id)
                      const percentage = score !== undefined && selectedExam
                        ? (score / selectedExam.totalPoints * 100)
                        : null
                      const yearLevel = student.enrollments[0]?.yearLevel
                      const isMentee = student.enrollments.some(e => e.mentorId === session?.user?.id)
                      const isPassing = percentage !== null && percentage >= 60

                      return (
                        <tr
                          key={student.id}
                          className={`border-b hover:bg-gray-50 ${isMentee ? 'bg-maroon-50' : ''}`}
                        >
                          <td className="p-2 text-gray-500">{index + 1}</td>
                          <td className="p-2">
                            <div className="font-medium">{student.name}</div>
                            {isMentee && <span className="text-xs text-maroon-600">Your Mentee</span>}
                          </td>
                          <td className="p-2 text-center">
                            <Badge variant="outline" className="text-xs">
                              {yearLevel === 'YEAR_1' ? 'Y1' : 'Y2'}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center justify-center gap-2">
                              <input
                                type="number"
                                placeholder="0"
                                value={score !== undefined ? score : ''}
                                onChange={(e) => handleScoreChange(student.id, e.target.value)}
                                disabled={!canEdit}
                                className={`w-20 px-2 py-1 text-center border rounded focus:outline-none focus:ring-1 focus:ring-maroon-500 ${!canEdit ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                min={0}
                                max={selectedExam?.totalPoints}
                                step="any"
                              />
                              <span className="text-gray-500">/ {selectedExam.totalPoints}</span>
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            {percentage !== null ? (
                              <span className={`font-medium ${isPassing ? 'text-green-600' : 'text-red-600'}`}>
                                {percentage.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {percentage !== null && (
                              <Badge className={isPassing ? 'bg-green-500' : 'bg-red-500'}>
                                {isPassing ? '✓ Pass' : '✗ Fail'}
                              </Badge>
                            )}
                          </td>
                          <td className="p-2">
                            <Textarea
                              placeholder="Optional notes..."
                              value={notes.get(student.id) || ''}
                              onChange={(e) => handleNotesChange(student.id, e.target.value)}
                              disabled={!canEdit}
                              className={`w-full text-xs min-h-[60px] ${!canEdit ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                              rows={2}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {filteredStudents.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    No eligible students for this exam
                  </div>
                )}
              </div>
            </Card>

            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-3">
              {filteredStudents.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-gray-500">
                    No eligible students for this exam
                  </CardContent>
                </Card>
              ) : (
                filteredStudents.map((student, index) => {
                  const score = scores.get(student.id)
                  const percentage = score !== undefined && selectedExam
                    ? (score / selectedExam.totalPoints * 100)
                    : null
                  const yearLevel = student.enrollments[0]?.yearLevel
                  const isMentee = student.enrollments.some(e => e.mentorId === session?.user?.id)
                  const isPassing = percentage !== null && percentage >= 60

                  return (
                    <Card key={student.id} className={isMentee ? 'border-maroon-300 bg-maroon-50' : ''}>
                      <CardContent className="p-4 space-y-3">
                        {/* Student Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">#{index + 1}</span>
                              <h3 className="font-semibold">{student.name}</h3>
                            </div>
                            {isMentee && (
                              <span className="text-xs text-maroon-600">Your Mentee</span>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {yearLevel === 'YEAR_1' ? 'Year 1' : 'Year 2'}
                          </Badge>
                        </div>

                        {/* Score Input */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Score</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              placeholder="0"
                              value={score !== undefined ? score : ''}
                              onChange={(e) => handleScoreChange(student.id, e.target.value)}
                              disabled={!canEdit}
                              className={`flex-1 px-3 py-2 text-center border rounded-md focus:outline-none focus:ring-2 focus:ring-maroon-500 ${!canEdit ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                              min={0}
                              max={selectedExam?.totalPoints}
                              step="any"
                            />
                            <span className="text-gray-600">/ {selectedExam.totalPoints}</span>
                          </div>
                        </div>

                        {/* Percentage & Status */}
                        {percentage !== null && (
                          <div className="flex items-center justify-between pt-2 border-t">
                            <div>
                              <div className="text-xs text-gray-500">Percentage</div>
                              <div className={`text-lg font-bold ${isPassing ? 'text-green-600' : 'text-red-600'}`}>
                                {percentage.toFixed(2)}%
                              </div>
                            </div>
                            <Badge className={isPassing ? 'bg-green-500' : 'bg-red-500'}>
                              {isPassing ? 'Pass' : 'Fail'}
                            </Badge>
                          </div>
                        )}

                        {/* Notes */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Notes (Optional)</label>
                          <Textarea
                            placeholder="Add notes for this student..."
                            value={notes.get(student.id) || ''}
                            onChange={(e) => handleNotesChange(student.id, e.target.value)}
                            disabled={!canEdit}
                            className={`w-full text-sm ${!canEdit ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                            rows={3}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </>
        )}

        {/* Create Exam Dialog */}
        <Dialog open={showCreateExam} onOpenChange={setShowCreateExam}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Exam</DialogTitle>
              <DialogDescription>
                Create a new exam for students to take
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Exam Section</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background mt-1"
                  value={newExam.examSectionId}
                  onChange={(e) => setNewExam({ ...newExam, examSectionId: e.target.value })}
                >
                  <option value="">Select section...</option>
                  {examSections.map(section => (
                    <option key={section.id} value={section.id}>
                      {section.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Year Level</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background mt-1"
                  value={newExam.yearLevel}
                  onChange={(e) => setNewExam({ ...newExam, yearLevel: e.target.value as 'YEAR_1' | 'YEAR_2' | 'BOTH' })}
                >
                  <option value="BOTH">All Students (Both Years)</option>
                  <option value="YEAR_1">Year 1 Only</option>
                  <option value="YEAR_2">Year 2 Only</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Exam Date</label>
                <Input
                  type="date"
                  value={newExam.examDate}
                  onChange={(e) => setNewExam({ ...newExam, examDate: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Total Points</label>
                <Input
                  type="number"
                  value={newExam.totalPoints}
                  onChange={(e) => setNewExam({ ...newExam, totalPoints: parseInt(e.target.value) })}
                  className="mt-1"
                />
              </div>

              <Button
                onClick={createExam}
                disabled={!newExam.examSectionId || !newExam.examDate}
                className="w-full"
              >
                Create Exam
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
