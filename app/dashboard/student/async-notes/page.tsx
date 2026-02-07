'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ChevronLeft, Send, Edit2, Trash2, Clock, CheckCircle, XCircle, FileText } from 'lucide-react'

interface NoteSubmission {
  id: string
  lessonId: string
  content: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  submittedAt: string
  reviewedAt: string | null
  reviewFeedback: string | null
  lesson: {
    id: string
    title: string
    subtitle: string | null
    lessonNumber: number
    scheduledDate: string
    examSection: {
      name: string
      displayName: string
    }
  }
  reviewer: {
    name: string
  } | null
}

interface Lesson {
  id: string
  title: string
  subtitle: string | null
  lessonNumber: number
  scheduledDate: string
  examSection: {
    name: string
    displayName: string
  }
}

export default function AsyncNotesPage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()
  const [submissions, setSubmissions] = useState<NoteSubmission[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [editingSubmission, setEditingSubmission] = useState<NoteSubmission | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [noteContent, setNoteContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    if (!session?.user?.id) return
    try {
      const [notesRes, lessonsRes] = await Promise.all([
        fetch(`/api/async-notes?studentId=${session.user.id}`),
        fetch('/api/lessons')
      ])

      if (notesRes.ok) {
        const data = await notesRes.json()
        setSubmissions(Array.isArray(data) ? data : data.data || [])
      }
      if (lessonsRes.ok) {
        const lessonsData = await lessonsRes.json()
        setLessons(Array.isArray(lessonsData) ? lessonsData : lessonsData.data || [])
      }
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login')
    else if (authStatus === 'authenticated' && session?.user?.role !== 'STUDENT') router.push('/dashboard')
    else if (authStatus === 'authenticated' && !session?.user?.isAsyncStudent) router.push('/dashboard/student')
  }, [authStatus, session, router])

  useEffect(() => {
    if (session?.user) fetchData()
  }, [session?.user, fetchData])

  const submittedLessonIds = new Set(submissions.map(s => s.lessonId))
  const availableLessons = lessons.filter(
    l => !submittedLessonIds.has(l.id) && new Date(l.scheduledDate) <= new Date()
  )

  const filteredSubmissions = statusFilter === 'all'
    ? submissions
    : submissions.filter(s => s.status === statusFilter)

  const handleSubmit = async () => {
    if (!noteContent.trim()) {
      toast.error('Please enter your notes')
      return
    }

    setSubmitting(true)
    try {
      if (editingSubmission) {
        const res = await fetch(`/api/async-notes/${editingSubmission.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: noteContent })
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to update')
        }
        toast.success('Notes updated successfully')
      } else if (selectedLesson) {
        const res = await fetch('/api/async-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId: selectedLesson.id, content: noteContent })
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to submit')
        }
        toast.success('Notes submitted successfully')
      }
      setSubmitDialogOpen(false)
      setNoteContent('')
      setSelectedLesson(null)
      setEditingSubmission(null)
      fetchData()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save notes')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/async-notes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Submission deleted')
      fetchData()
    } catch {
      toast.error('Failed to delete submission')
    }
  }

  const openEdit = (submission: NoteSubmission) => {
    setEditingSubmission(submission)
    setNoteContent(submission.content)
    setSubmitDialogOpen(true)
  }

  const openNew = (lesson?: Lesson) => {
    setEditingSubmission(null)
    setSelectedLesson(lesson || null)
    setNoteContent('')
    setSubmitDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'APPROVED': return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>
      case 'REJECTED': return <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading || authStatus === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-lg">Loading...</div></div>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/student')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold dark:text-white">My Lesson Notes</h1>
            <p className="text-gray-600 dark:text-gray-400">Submit notes for lessons to count as attendance</p>
          </div>
          <Button onClick={() => openNew()} className="bg-blue-600 hover:bg-blue-700">
            <Send className="h-4 w-4 mr-2" />
            Submit Notes
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('all')}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{submissions.length}</div>
              <div className="text-xs text-gray-500">Total</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('PENDING')}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{submissions.filter(s => s.status === 'PENDING').length}</div>
              <div className="text-xs text-yellow-600">Pending</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('APPROVED')}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{submissions.filter(s => s.status === 'APPROVED').length}</div>
              <div className="text-xs text-green-600">Approved</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('REJECTED')}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{submissions.filter(s => s.status === 'REJECTED').length}</div>
              <div className="text-xs text-red-600">Rejected</div>
            </CardContent>
          </Card>
        </div>

        {/* Submissions List */}
        <div className="space-y-3">
          {filteredSubmissions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>{statusFilter === 'all' ? 'No submissions yet. Submit notes for a lesson to get started.' : `No ${statusFilter.toLowerCase()} submissions.`}</p>
              </CardContent>
            </Card>
          ) : (
            filteredSubmissions.map(submission => (
              <Card key={submission.id} className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">
                        Lesson {submission.lesson.lessonNumber}: {submission.lesson.title}
                      </CardTitle>
                      <p className="text-xs text-gray-500 mt-1">
                        {submission.lesson.examSection.displayName} &bull;{' '}
                        {new Date(submission.lesson.scheduledDate).toLocaleDateString()}
                      </p>
                    </div>
                    {getStatusBadge(submission.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {submission.content}
                  </div>

                  {submission.status === 'REJECTED' && submission.reviewFeedback && (
                    <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 rounded">
                      <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Feedback from reviewer:</p>
                      <p className="text-sm text-red-600 dark:text-red-300">{submission.reviewFeedback}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Submitted {new Date(submission.submittedAt).toLocaleString()}</span>
                    <div className="flex gap-2">
                      {(submission.status === 'PENDING' || submission.status === 'REJECTED') && (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(submission)}>
                          <Edit2 className="h-3 w-3 mr-1" />{submission.status === 'REJECTED' ? 'Resubmit' : 'Edit'}
                        </Button>
                      )}
                      {submission.status === 'PENDING' && (
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(submission.id)}>
                          <Trash2 className="h-3 w-3 mr-1" />Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Submit/Edit Dialog */}
        <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingSubmission ? 'Edit Submission' : 'Submit Lesson Notes'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {!editingSubmission && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Lesson</label>
                  <Select
                    value={selectedLesson?.id || ''}
                    onValueChange={(val) => setSelectedLesson(availableLessons.find(l => l.id === val) || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a lesson..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLessons.map(lesson => (
                        <SelectItem key={lesson.id} value={lesson.id}>
                          #{lesson.lessonNumber} - {lesson.title} ({lesson.examSection.displayName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availableLessons.length === 0 && (
                    <p className="text-xs text-gray-500">No lessons available for submission.</p>
                  )}
                </div>
              )}
              {editingSubmission && (
                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                  <p className="text-sm font-medium">
                    Lesson {editingSubmission.lesson.lessonNumber}: {editingSubmission.lesson.title}
                  </p>
                  <p className="text-xs text-gray-500">{editingSubmission.lesson.examSection.displayName}</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Notes</label>
                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Write your lesson notes here. Include key points, summaries, and reflections..."
                  rows={8}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || (!editingSubmission && !selectedLesson) || !noteContent.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? 'Saving...' : editingSubmission ? 'Update Notes' : 'Submit Notes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
