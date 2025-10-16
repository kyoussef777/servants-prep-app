'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Edit, Check, X } from 'lucide-react'

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

interface Mentor {
  id: string
  name: string
  email?: string
}

interface StudentDetailsModalProps {
  studentId: string | null
  studentName: string
  yearLevel?: string
  mentor?: Mentor | null
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
  yearLevel,
  mentor,
  examScores,
  attendanceRecords,
  allExams = [],
  allLessons = [],
  loading,
  onClose,
  onRefresh
}: StudentDetailsModalProps) {
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null)
  const [editingScore, setEditingScore] = useState<number>(0)
  const [editingScoreNotes, setEditingScoreNotes] = useState<string>('')
  const [editingAttendanceId, setEditingAttendanceId] = useState<string | null>(null)

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

  const updateAttendance = async (recordId: string, status: 'PRESENT' | 'LATE' | 'ABSENT') => {
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

  // Debug: Log exam scores to check if they're different
  if (examScores.length > 0) {
    console.log('Exam Scores:', examScores.map(s => ({
      id: s.id,
      examId: s.exam.id,
      score: s.score,
      percentage: s.percentage,
      examDate: s.exam.examDate,
      section: s.exam.examSection.displayName
    })))
  }

  // Find missing exams (exams student hasn't taken yet)
  const takenExamIds = new Set(examScores.map(s => s.exam.id))
  const missingExams = allExams.filter(exam => !takenExamIds.has(exam.id))

  // Separate attendance by year level
  const year1Attendance = attendanceRecords.filter(r =>
    r.lesson.examSection.yearLevel === 'YEAR_1'
  )
  const year2Attendance = attendanceRecords.filter(r =>
    r.lesson.examSection.yearLevel === 'YEAR_2'
  )

  // Calculate attendance stats
  const presentCount = attendanceRecords.filter(r => r.status === 'PRESENT').length
  const lateCount = attendanceRecords.filter(r => r.status === 'LATE').length
  const absentCount = attendanceRecords.filter(r => r.status === 'ABSENT').length
  const totalRecords = attendanceRecords.length
  const attendanceRate = totalRecords > 0
    ? ((presentCount + (lateCount / 2)) / totalRecords) * 100
    : 0

  // Year 1 attendance stats
  const year1Present = year1Attendance.filter(r => r.status === 'PRESENT').length
  const year1Late = year1Attendance.filter(r => r.status === 'LATE').length
  const year1Absent = year1Attendance.filter(r => r.status === 'ABSENT').length
  const year1Total = year1Attendance.length
  const year1Rate = year1Total > 0
    ? ((year1Present + (year1Late / 2)) / year1Total) * 100
    : 0

  // Year 2 attendance stats
  const year2Present = year2Attendance.filter(r => r.status === 'PRESENT').length
  const year2Late = year2Attendance.filter(r => r.status === 'LATE').length
  const year2Absent = year2Attendance.filter(r => r.status === 'ABSENT').length
  const year2Total = year2Attendance.length
  const year2Rate = year2Total > 0
    ? ((year2Present + (year2Late / 2)) / year2Total) * 100
    : 0

  return (
    <Dialog open={!!studentId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
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
          <Tabs defaultValue="scores" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="scores">Exam Scores</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
            </TabsList>

            <TabsContent value="scores" className="space-y-4">
              {/* Score Summary */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">Average Score</div>
                      <div className={`text-2xl font-bold ${avgScore >= 75 ? 'text-green-700' : avgScore >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
                        {avgScore.toFixed(1)}%
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
                                    {new Date(score.exam.examDate).toLocaleDateString('en-US', {
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
                                          {score.percentage.toFixed(1)}%
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
                                {new Date(exam.examDate).toLocaleDateString('en-US', {
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">Rate</div>
                      <div className={`text-2xl font-bold ${attendanceRate >= 75 ? 'text-green-700' : attendanceRate >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
                        {attendanceRate.toFixed(1)}%
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
                  </div>
                </CardContent>
              </Card>

              {/* Year 1 Attendance */}
              {year1Attendance.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-3">Year 1 Attendance</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">Rate</div>
                        <div className={`text-2xl font-bold ${year1Rate >= 75 ? 'text-green-700' : year1Rate >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
                          {year1Rate.toFixed(1)}%
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
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Year 2 Attendance */}
              {year2Attendance.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-3">Year 2 Attendance</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">Rate</div>
                        <div className={`text-2xl font-bold ${year2Rate >= 75 ? 'text-green-700' : year2Rate >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
                          {year2Rate.toFixed(1)}%
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
                        <div className="font-medium text-sm">{record.lesson.title}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(record.lesson.scheduledDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                          {' • '}
                          {record.lesson.examSection.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingAttendanceId === record.id ? (
                          <>
                            <select
                              value={record.status}
                              onChange={(e) => updateAttendance(record.id, e.target.value as 'PRESENT' | 'LATE' | 'ABSENT')}
                              className="border rounded px-2 py-1 text-sm"
                            >
                              <option value="PRESENT">Present</option>
                              <option value="LATE">Late</option>
                              <option value="ABSENT">Absent</option>
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
