'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { TableSkeleton } from '@/components/ui/skeleton'
import { formatDateUTC } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Check,
  X,
  RotateCcw,
  Search,
  FileText,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AsyncNoteSubmission {
  id: string
  studentId: string
  lessonId: string
  content: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  submittedAt: string
  reviewedBy: string | null
  reviewedAt: string | null
  reviewFeedback: string | null
  attendanceRecordId: string | null
  student: {
    id: string
    name: string
    email: string
  }
  lesson: {
    id: string
    title: string
    lessonNumber: number
    scheduledDate: string
    examSection: {
      id: string
      name: string
      displayName: string
    }
  }
  reviewer?: {
    id: string
    name: string
  } | null
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: AsyncNoteSubmission['status'] }) {
  switch (status) {
    case 'PENDING':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      )
    case 'APPROVED':
      return (
        <Badge className="bg-green-100 text-green-800 border border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      )
    case 'REJECTED':
      return (
        <Badge className="bg-red-100 text-red-800 border border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      )
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AsyncNotesPanel({ canReview, isReadOnly }: { canReview: boolean; isReadOnly: boolean }) {
  // Data
  const [submissions, setSubmissions] = useState<AsyncNoteSubmission[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('PENDING')
  const [searchTerm, setSearchTerm] = useState('')

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Preview
  const [previewSubmission, setPreviewSubmission] = useState<AsyncNoteSubmission | null>(null)

  // Rejection dialog
  const [rejectTarget, setRejectTarget] = useState<AsyncNoteSubmission | null>(null)
  const [rejectFeedback, setRejectFeedback] = useState('')
  const [rejecting, setRejecting] = useState(false)

  // Revert confirmation dialog
  const [revertTarget, setRevertTarget] = useState<AsyncNoteSubmission | null>(null)
  const [reverting, setReverting] = useState(false)

  // Bulk actions
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null)
  const [bulkFeedback, setBulkFeedback] = useState('')
  const [bulkProcessing, setBulkProcessing] = useState(false)

  // Single action processing
  const [processingId, setProcessingId] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Fetch submissions
  // ---------------------------------------------------------------------------

  const fetchSubmissions = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      const res = await fetch(`/api/async-notes?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Failed to fetch submissions')
      }
      const data = await res.json()
      setSubmissions(Array.isArray(data) ? data : (data.submissions ?? []))
    } catch (error: unknown) {
      console.error('Failed to fetch async notes:', error)
      toast.error('Failed to load submissions', {
        description: error instanceof Error ? error.message : 'Please try again.',
      })
      setSubmissions([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    setLoading(true)
    fetchSubmissions()
  }, [fetchSubmissions])

  // ---------------------------------------------------------------------------
  // Filtering and sorting
  // ---------------------------------------------------------------------------

  const filteredSubmissions = useMemo(() => {
    let result = submissions

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (s) =>
          s.student.name.toLowerCase().includes(term) ||
          s.lesson.title.toLowerCase().includes(term)
      )
    }

    // Sort by submittedAt descending (newest first)
    return [...result].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    )
  }, [submissions, searchTerm])

  // Stats
  const stats = useMemo(() => {
    const all = submissions
    return {
      total: all.length,
      pending: all.filter((s) => s.status === 'PENDING').length,
      approved: all.filter((s) => s.status === 'APPROVED').length,
      rejected: all.filter((s) => s.status === 'REJECTED').length,
    }
  }, [submissions])

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

  const pendingFilteredIds = useMemo(
    () => filteredSubmissions.filter((s) => s.status === 'PENDING').map((s) => s.id),
    [filteredSubmissions]
  )

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (pendingFilteredIds.length === 0) return
    setSelectedIds((prev) => {
      const allSelected = pendingFilteredIds.every((id) => prev.has(id))
      if (allSelected) {
        // Deselect all pending
        const next = new Set(prev)
        pendingFilteredIds.forEach((id) => next.delete(id))
        return next
      } else {
        // Select all pending
        const next = new Set(prev)
        pendingFilteredIds.forEach((id) => next.add(id))
        return next
      }
    })
  }

  const selectedPendingCount = useMemo(
    () => Array.from(selectedIds).filter((id) => pendingFilteredIds.includes(id)).length,
    [selectedIds, pendingFilteredIds]
  )

  // ---------------------------------------------------------------------------
  // Single review action
  // ---------------------------------------------------------------------------

  const handleSingleReview = async (
    submissionId: string,
    reviewStatus: 'APPROVED' | 'REJECTED' | 'PENDING',
    feedback?: string
  ) => {
    setProcessingId(submissionId)
    try {
      const res = await fetch(`/api/async-notes/${submissionId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: reviewStatus, feedback }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to review submission')
      }

      const now = new Date()
      const actionLabel =
        reviewStatus === 'APPROVED'
          ? 'Approved'
          : reviewStatus === 'REJECTED'
            ? 'Rejected'
            : 'Reverted'
      toast.success(`Submission ${actionLabel.toLowerCase()}`, {
        description: now.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
      })

      await fetchSubmissions()
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(submissionId)
        return next
      })
    } catch (error: unknown) {
      toast.error('Review failed', {
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setProcessingId(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Approve single
  // ---------------------------------------------------------------------------

  const handleApprove = (submissionId: string) => {
    handleSingleReview(submissionId, 'APPROVED')
  }

  // ---------------------------------------------------------------------------
  // Reject single (opens dialog)
  // ---------------------------------------------------------------------------

  const openRejectDialog = (submission: AsyncNoteSubmission) => {
    setRejectTarget(submission)
    setRejectFeedback('')
  }

  const confirmReject = async () => {
    if (!rejectTarget) return
    setRejecting(true)
    await handleSingleReview(rejectTarget.id, 'REJECTED', rejectFeedback || undefined)
    setRejecting(false)
    setRejectTarget(null)
    setRejectFeedback('')
  }

  // ---------------------------------------------------------------------------
  // Revert single (opens confirmation dialog)
  // ---------------------------------------------------------------------------

  const openRevertDialog = (submission: AsyncNoteSubmission) => {
    setRevertTarget(submission)
  }

  const confirmRevert = async () => {
    if (!revertTarget) return
    setReverting(true)
    await handleSingleReview(revertTarget.id, 'PENDING')
    setReverting(false)
    setRevertTarget(null)
  }

  // ---------------------------------------------------------------------------
  // Bulk review
  // ---------------------------------------------------------------------------

  const openBulkAction = (action: 'approve' | 'reject') => {
    setBulkAction(action)
    setBulkFeedback('')
  }

  const confirmBulkAction = async () => {
    if (!bulkAction) return

    const ids = Array.from(selectedIds).filter((id) => pendingFilteredIds.includes(id))
    if (ids.length === 0) {
      toast.error('No pending submissions selected')
      setBulkAction(null)
      return
    }

    setBulkProcessing(true)
    try {
      const reviewStatus = bulkAction === 'approve' ? 'APPROVED' : 'REJECTED'
      const res = await fetch('/api/async-notes/bulk-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionIds: ids,
          status: reviewStatus,
          feedback: bulkAction === 'reject' && bulkFeedback ? bulkFeedback : undefined,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Bulk review failed')
      }

      const result = await res.json()
      const now = new Date()
      toast.success(
        `${result.count ?? ids.length} submission(s) ${bulkAction === 'approve' ? 'approved' : 'rejected'}`,
        {
          description: now.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }),
        }
      )

      setSelectedIds(new Set())
      await fetchSubmissions()
    } catch (error: unknown) {
      toast.error('Bulk review failed', {
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setBulkProcessing(false)
      setBulkAction(null)
      setBulkFeedback('')
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          <CardContent className="pt-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold dark:text-white">
              {loading ? '-' : stats.total}
            </div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Total Submissions
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'PENDING' ? 'ring-2 ring-yellow-500' : ''}`}
          onClick={() => setStatusFilter('PENDING')}
        >
          <CardContent className="pt-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-yellow-700 dark:text-yellow-400">
              {loading ? '-' : stats.pending}
            </div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Pending</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'APPROVED' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setStatusFilter('APPROVED')}
        >
          <CardContent className="pt-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-400">
              {loading ? '-' : stats.approved}
            </div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Approved</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'REJECTED' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => setStatusFilter('REJECTED')}
        >
          <CardContent className="pt-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-red-700 dark:text-red-400">
              {loading ? '-' : stats.rejected}
            </div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Rejected</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Bulk Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="text-base sm:text-lg dark:text-white">
              Submissions ({filteredSubmissions.length})
            </CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search student or lesson..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm w-full sm:w-64 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                />
              </div>
              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList className="hidden sm:flex">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="PENDING">Pending</TabsTrigger>
                  <TabsTrigger value="APPROVED">Approved</TabsTrigger>
                  <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
                </TabsList>
              </Tabs>
              {/* Mobile status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="sm:hidden h-9 px-2 rounded-md border border-input bg-background text-sm dark:bg-gray-800 dark:text-white dark:border-gray-600"
              >
                <option value="all">All</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
        </CardHeader>

        {/* Bulk Actions Bar */}
        {selectedPendingCount > 0 && canReview && (
          <div className="px-4 sm:px-6 pb-3">
            <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
              <CardContent className="py-3 px-4">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="text-sm font-medium dark:text-white">
                    {selectedPendingCount} pending submission(s) selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => openBulkAction('approve')}
                      className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openBulkAction('reject')}
                      className="gap-1 text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950/30"
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject All
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <CardContent className="pt-0">
          {loading ? (
            <TableSkeleton rows={5} columns={6} />
          ) : filteredSubmissions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {searchTerm
                  ? 'No submissions match your search'
                  : statusFilter !== 'all'
                    ? `No ${statusFilter.toLowerCase()} submissions`
                    : 'No submissions yet'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b dark:border-gray-700">
                    <tr>
                      {canReview && (
                        <th className="text-left p-3 w-10">
                          <input
                            type="checkbox"
                            checked={
                              pendingFilteredIds.length > 0 &&
                              pendingFilteredIds.every((id) => selectedIds.has(id))
                            }
                            onChange={toggleSelectAll}
                            className="rounded"
                            title="Select all pending"
                            disabled={pendingFilteredIds.length === 0}
                          />
                        </th>
                      )}
                      <th className="text-left p-3 font-semibold dark:text-gray-300">
                        Student
                      </th>
                      <th className="text-left p-3 font-semibold dark:text-gray-300">Lesson</th>
                      <th className="text-left p-3 font-semibold dark:text-gray-300">
                        Section
                      </th>
                      <th className="text-left p-3 font-semibold dark:text-gray-300">
                        Submitted
                      </th>
                      <th className="text-left p-3 font-semibold dark:text-gray-300">Status</th>
                      <th className="text-left p-3 font-semibold dark:text-gray-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map((submission) => (
                      <SubmissionTableRow
                        key={submission.id}
                        submission={submission}
                        isSelected={selectedIds.has(submission.id)}
                        onToggleSelect={() => toggleSelect(submission.id)}
                        onPreview={() => setPreviewSubmission(submission)}
                        onApprove={() => handleApprove(submission.id)}
                        onReject={() => openRejectDialog(submission)}
                        onRevert={() => openRevertDialog(submission)}
                        canReview={canReview}
                        isReadOnly={isReadOnly}
                        isProcessing={processingId === submission.id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout */}
              <div className="lg:hidden space-y-3">
                {filteredSubmissions.map((submission) => (
                  <SubmissionMobileCard
                    key={submission.id}
                    submission={submission}
                    isSelected={selectedIds.has(submission.id)}
                    onToggleSelect={() => toggleSelect(submission.id)}
                    onPreview={() => setPreviewSubmission(submission)}
                    onApprove={() => handleApprove(submission.id)}
                    onReject={() => openRejectDialog(submission)}
                    onRevert={() => openRevertDialog(submission)}
                    canReview={canReview}
                    isReadOnly={isReadOnly}
                    isProcessing={processingId === submission.id}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Preview Dialog                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={!!previewSubmission}
        onOpenChange={(open) => {
          if (!open) setPreviewSubmission(null)
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto dark:bg-gray-900">
          {previewSubmission && (
            <>
              <DialogHeader>
                <DialogTitle className="dark:text-white">
                  L{previewSubmission.lesson.lessonNumber}: {previewSubmission.lesson.title}
                </DialogTitle>
                <DialogDescription>
                  Submitted by {previewSubmission.student.name} on{' '}
                  {new Date(previewSubmission.submittedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
                  <StatusBadge status={previewSubmission.status} />
                </div>

                {/* Section */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Section:</span>
                  <Badge variant="outline">{previewSubmission.lesson.examSection.displayName}</Badge>
                </div>

                {/* Lesson Date */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Lesson Date:</span>
                  <span className="text-sm dark:text-white">
                    {formatDateUTC(previewSubmission.lesson.scheduledDate)}
                  </span>
                </div>

                {/* Content */}
                <div>
                  <h4 className="text-sm font-medium mb-2 dark:text-gray-300">Student Notes</h4>
                  <div className="rounded-md border p-4 bg-gray-50 dark:bg-gray-800 dark:border-gray-700 max-h-64 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap dark:text-gray-200">
                      {previewSubmission.content}
                    </p>
                  </div>
                </div>

                {/* Review Feedback (if rejected) */}
                {previewSubmission.reviewFeedback && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-red-700 dark:text-red-400">
                      Reviewer Feedback
                    </h4>
                    <div className="rounded-md border border-red-200 dark:border-red-800 p-4 bg-red-50 dark:bg-red-950/30">
                      <p className="text-sm whitespace-pre-wrap text-red-800 dark:text-red-300">
                        {previewSubmission.reviewFeedback}
                      </p>
                    </div>
                    {previewSubmission.reviewer && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Reviewed by {previewSubmission.reviewer.name}
                        {previewSubmission.reviewedAt &&
                          ` on ${new Date(previewSubmission.reviewedAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}`}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons in preview */}
              {canReview && (
                <DialogFooter className="gap-2">
                  {previewSubmission.status === 'PENDING' && (
                    <>
                      <Button
                        onClick={() => {
                          handleApprove(previewSubmission.id)
                          setPreviewSubmission(null)
                        }}
                        disabled={processingId === previewSubmission.id}
                        className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPreviewSubmission(null)
                          openRejectDialog(previewSubmission)
                        }}
                        disabled={processingId === previewSubmission.id}
                        className="gap-1 text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700"
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}
                  {previewSubmission.status === 'APPROVED' && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPreviewSubmission(null)
                        openRevertDialog(previewSubmission)
                      }}
                      disabled={processingId === previewSubmission.id}
                      className="gap-1 text-orange-700 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Revert
                    </Button>
                  )}
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Rejection Feedback Dialog                                           */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null)
            setRejectFeedback('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Reject Submission</DialogTitle>
            <DialogDescription>
              {rejectTarget && (
                <>
                  Rejecting notes from <strong>{rejectTarget.student.name}</strong> for L
                  {rejectTarget.lesson.lessonNumber}: {rejectTarget.lesson.title}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="text-sm font-medium dark:text-gray-300">
              Feedback for student (optional)
            </label>
            <Textarea
              placeholder="Explain why this submission was rejected so the student can improve and resubmit..."
              value={rejectFeedback}
              onChange={(e) => setRejectFeedback(e.target.value)}
              className="min-h-24 dark:bg-gray-800 dark:text-white dark:border-gray-600"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null)
                setRejectFeedback('')
              }}
              disabled={rejecting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmReject}
              disabled={rejecting}
              className="gap-1 bg-red-600 hover:bg-red-700 text-white"
            >
              <X className="h-4 w-4" />
              {rejecting ? 'Rejecting...' : 'Reject Submission'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Revert Confirmation AlertDialog                                     */}
      {/* ------------------------------------------------------------------ */}
      <AlertDialog
        open={!!revertTarget}
        onOpenChange={(open) => {
          if (!open) setRevertTarget(null)
        }}
      >
        <AlertDialogContent className="dark:bg-gray-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Revert Approval</AlertDialogTitle>
            <AlertDialogDescription>
              {revertTarget && (
                <>
                  This will revert the approval for <strong>{revertTarget.student.name}</strong>
                  &apos;s notes on L{revertTarget.lesson.lessonNumber}:{' '}
                  {revertTarget.lesson.title}. The linked attendance record will be deleted and the
                  submission will return to pending status.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reverting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevert}
              disabled={reverting}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              {reverting ? 'Reverting...' : 'Revert Approval'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ------------------------------------------------------------------ */}
      {/* Bulk Action Dialog                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={!!bulkAction}
        onOpenChange={(open) => {
          if (!open) {
            setBulkAction(null)
            setBulkFeedback('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="dark:text-white">
              {bulkAction === 'approve'
                ? `Approve ${selectedPendingCount} Submission(s)`
                : `Reject ${selectedPendingCount} Submission(s)`}
            </DialogTitle>
            <DialogDescription>
              {bulkAction === 'approve'
                ? 'All selected pending submissions will be approved and attendance records will be created.'
                : 'All selected pending submissions will be rejected.'}
            </DialogDescription>
          </DialogHeader>

          {bulkAction === 'reject' && (
            <div className="space-y-3">
              <label className="text-sm font-medium dark:text-gray-300">
                Feedback for all students (optional)
              </label>
              <Textarea
                placeholder="This feedback will be applied to all rejected submissions..."
                value={bulkFeedback}
                onChange={(e) => setBulkFeedback(e.target.value)}
                className="min-h-24 dark:bg-gray-800 dark:text-white dark:border-gray-600"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkAction(null)
                setBulkFeedback('')
              }}
              disabled={bulkProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmBulkAction}
              disabled={bulkProcessing}
              className={
                bulkAction === 'approve'
                  ? 'gap-1 bg-green-600 hover:bg-green-700 text-white'
                  : 'gap-1 bg-red-600 hover:bg-red-700 text-white'
              }
            >
              {bulkAction === 'approve' ? (
                <Check className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
              {bulkProcessing
                ? 'Processing...'
                : bulkAction === 'approve'
                  ? `Approve ${selectedPendingCount}`
                  : `Reject ${selectedPendingCount}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Desktop table row
// ---------------------------------------------------------------------------

function SubmissionTableRow({
  submission,
  isSelected,
  onToggleSelect,
  onPreview,
  onApprove,
  onReject,
  onRevert,
  canReview,
  isReadOnly,
  isProcessing,
}: {
  submission: AsyncNoteSubmission
  isSelected: boolean
  onToggleSelect: () => void
  onPreview: () => void
  onApprove: () => void
  onReject: () => void
  onRevert: () => void
  canReview: boolean
  isReadOnly: boolean
  isProcessing: boolean
}) {
  return (
    <tr className="border-b hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50">
      {canReview && (
        <td className="p-3">
          {submission.status === 'PENDING' ? (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="rounded"
              disabled={isProcessing}
            />
          ) : (
            <span className="w-4 inline-block" />
          )}
        </td>
      )}
      <td className="p-3">
        <div className="font-medium dark:text-white">{submission.student.name}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{submission.student.email}</div>
      </td>
      <td className="p-3">
        <div className="dark:text-white">
          L{submission.lesson.lessonNumber}: {submission.lesson.title}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {formatDateUTC(submission.lesson.scheduledDate, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </div>
      </td>
      <td className="p-3">
        <Badge variant="outline" className="text-xs">
          {submission.lesson.examSection.displayName}
        </Badge>
      </td>
      <td className="p-3 dark:text-gray-300">
        <div className="text-sm">
          {new Date(submission.submittedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(submission.submittedAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </div>
      </td>
      <td className="p-3">
        <StatusBadge status={submission.status} />
      </td>
      <td className="p-3">
        <div className="flex items-center gap-1">
          {/* Preview button - always visible */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onPreview}
            className="gap-1 h-8 px-2"
            title="Preview submission"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>

          {/* Action buttons only for reviewers (not PRIEST) */}
          {canReview && !isReadOnly && (
            <>
              {submission.status === 'PENDING' && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onApprove}
                    disabled={isProcessing}
                    className="h-8 px-2 text-green-700 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
                    title="Approve"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onReject}
                    disabled={isProcessing}
                    className="h-8 px-2 text-red-700 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    title="Reject"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
              {submission.status === 'APPROVED' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onRevert}
                  disabled={isProcessing}
                  className="h-8 px-2 text-orange-700 hover:text-orange-800 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/30"
                  title="Revert approval"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Mobile card
// ---------------------------------------------------------------------------

function SubmissionMobileCard({
  submission,
  isSelected,
  onToggleSelect,
  onPreview,
  onApprove,
  onReject,
  onRevert,
  canReview,
  isReadOnly,
  isProcessing,
}: {
  submission: AsyncNoteSubmission
  isSelected: boolean
  onToggleSelect: () => void
  onPreview: () => void
  onApprove: () => void
  onReject: () => void
  onRevert: () => void
  canReview: boolean
  isReadOnly: boolean
  isProcessing: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="overflow-hidden dark:bg-gray-900 dark:border-gray-700">
      <CardContent className="p-3 sm:p-4">
        {/* Top row: checkbox + info + status */}
        <div className="flex items-start gap-2 sm:gap-3">
          {canReview && submission.status === 'PENDING' && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="rounded mt-1"
              disabled={isProcessing}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-sm dark:text-white truncate">
                  {submission.student.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  L{submission.lesson.lessonNumber}: {submission.lesson.title}
                </div>
              </div>
              <StatusBadge status={submission.status} />
            </div>

            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              <Badge variant="outline" className="text-[10px] px-1.5">
                {submission.lesson.examSection.displayName}
              </Badge>
              <span>
                {new Date(submission.submittedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-3 pt-3 border-t dark:border-gray-700 space-y-3">
            {/* Preview of content */}
            <div className="rounded-md border p-3 bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 line-clamp-4 whitespace-pre-wrap">
                {submission.content}
              </p>
              {submission.content.length > 200 && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={onPreview}
                  className="h-auto p-0 mt-1 text-xs"
                >
                  Read full notes
                </Button>
              )}
            </div>

            {/* Rejection feedback */}
            {submission.reviewFeedback && (
              <div className="rounded-md border border-red-200 dark:border-red-800 p-3 bg-red-50 dark:bg-red-950/30">
                <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">
                  Reviewer Feedback
                </p>
                <p className="text-xs text-red-800 dark:text-red-300 whitespace-pre-wrap">
                  {submission.reviewFeedback}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onPreview}
                className="gap-1 text-xs h-8"
              >
                <Eye className="h-3 w-3" />
                Full Preview
              </Button>

              {canReview && !isReadOnly && (
                <>
                  {submission.status === 'PENDING' && (
                    <>
                      <Button
                        size="sm"
                        onClick={onApprove}
                        disabled={isProcessing}
                        className="gap-1 text-xs h-8 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Check className="h-3 w-3" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onReject}
                        disabled={isProcessing}
                        className="gap-1 text-xs h-8 text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700"
                      >
                        <X className="h-3 w-3" />
                        Reject
                      </Button>
                    </>
                  )}
                  {submission.status === 'APPROVED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onRevert}
                      disabled={isProcessing}
                      className="gap-1 text-xs h-8 text-orange-700 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Revert
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
