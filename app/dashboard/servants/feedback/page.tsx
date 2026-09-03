'use client'

import { useState, type FormEvent } from 'react'
import {
  SundaySchoolFeedbackStatus,
  SundaySchoolFeedbackVoteType,
} from '@prisma/client'
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/admin/page-header'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageLoading } from '@/components/ui/page-loading'
import { Textarea } from '@/components/ui/textarea'
import { useSundaySchoolGuard } from '@/hooks/useSundaySchoolGuard'
import {
  FEEDBACK_DESCRIPTION_MAX_LENGTH,
  FEEDBACK_TITLE_MAX_LENGTH,
} from '@/lib/sunday-school-feedback'
import { useSundaySchoolFeedback } from '@/lib/swr'
import type {
  SundaySchoolFeedbackIdea,
  SundaySchoolFeedbackResponse,
} from '@/types/sunday-school'

const STATUS_LABELS: Record<SundaySchoolFeedbackStatus, string> = {
  OPEN: 'Open',
  PLANNED: 'Planned',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  DECLINED: 'Declined',
}

const STATUS_STYLES: Record<SundaySchoolFeedbackStatus, string> = {
  OPEN: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
  PLANNED: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
  DECLINED: 'border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

function formatSubmittedDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function optimisticVote(
  response: SundaySchoolFeedbackResponse,
  ideaId: string,
  nextVote: SundaySchoolFeedbackVoteType | null
): SundaySchoolFeedbackResponse {
  return {
    ...response,
    ideas: response.ideas.map(idea => {
      if (idea.id !== ideaId) return idea

      let upvotes = idea.upvotes
      let downvotes = idea.downvotes
      if (idea.viewerVote === SundaySchoolFeedbackVoteType.UP) upvotes--
      if (idea.viewerVote === SundaySchoolFeedbackVoteType.DOWN) downvotes--
      if (nextVote === SundaySchoolFeedbackVoteType.UP) upvotes++
      if (nextVote === SundaySchoolFeedbackVoteType.DOWN) downvotes++

      return {
        ...idea,
        upvotes,
        downvotes,
        score: upvotes - downvotes,
        viewerVote: nextVote,
      }
    }),
  }
}

export default function SundaySchoolFeedbackPage() {
  const { status: sessionStatus } = useSundaySchoolGuard()
  const { data, error, isLoading, mutate } = useSundaySchoolFeedback('ALL', 'TOP')
  const response = data as SundaySchoolFeedbackResponse | undefined

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingIdea, setEditingIdea] = useState<SundaySchoolFeedbackIdea | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [votingIdeaId, setVotingIdeaId] = useState<string | null>(null)
  const [statusSavingIdeaId, setStatusSavingIdeaId] = useState<string | null>(null)
  const [deleteIdea, setDeleteIdea] = useState<SundaySchoolFeedbackIdea | null>(null)
  const [deleting, setDeleting] = useState(false)

  const openCreateDialog = () => {
    setEditingIdea(null)
    setTitle('')
    setDescription('')
    setDialogOpen(true)
  }

  const openEditDialog = (idea: SundaySchoolFeedbackIdea) => {
    setEditingIdea(idea)
    setTitle(idea.title)
    setDescription(idea.description ?? '')
    setDialogOpen(true)
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(
        editingIdea
          ? `/api/sunday-school/feedback/${editingIdea.id}`
          : '/api/sunday-school/feedback',
        {
          method: editingIdea ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description }),
        }
      )
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to save the idea')

      setDialogOpen(false)
      setEditingIdea(null)
      setTitle('')
      setDescription('')
      await mutate()
      toast.success(editingIdea ? 'Idea updated' : 'Idea submitted')
    } catch (saveError: unknown) {
      toast.error(saveError instanceof Error ? saveError.message : 'Failed to save the idea')
    } finally {
      setSaving(false)
    }
  }

  const handleVote = async (
    idea: SundaySchoolFeedbackIdea,
    requestedVote: SundaySchoolFeedbackVoteType
  ) => {
    if (!response || !idea.canVote || votingIdeaId) return
    const nextVote = idea.viewerVote === requestedVote ? null : requestedVote
    const previous = response

    setVotingIdeaId(idea.id)
    await mutate(optimisticVote(previous, idea.id, nextVote), { revalidate: false })

    try {
      const res = await fetch(`/api/sunday-school/feedback/${idea.id}/vote`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: nextVote }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to save your vote')
      await mutate()
    } catch (voteError: unknown) {
      await mutate(previous, { revalidate: false })
      toast.error(voteError instanceof Error ? voteError.message : 'Failed to save your vote')
    } finally {
      setVotingIdeaId(null)
    }
  }

  const handleStatusChange = async (
    idea: SundaySchoolFeedbackIdea,
    nextStatus: SundaySchoolFeedbackStatus
  ) => {
    setStatusSavingIdeaId(idea.id)
    try {
      const res = await fetch(`/api/sunday-school/feedback/${idea.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to update the status')
      await mutate()
      toast.success(`Idea marked ${STATUS_LABELS[nextStatus].toLowerCase()}`)
    } catch (statusError: unknown) {
      toast.error(
        statusError instanceof Error ? statusError.message : 'Failed to update the status'
      )
    } finally {
      setStatusSavingIdeaId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteIdea) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/sunday-school/feedback/${deleteIdea.id}`, {
        method: 'DELETE',
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to delete the idea')
      setDeleteIdea(null)
      await mutate()
      toast.success('Idea deleted')
    } catch (deleteError: unknown) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Failed to delete the idea')
    } finally {
      setDeleting(false)
    }
  }

  if (sessionStatus === 'loading' || isLoading) return <PageLoading />

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-950 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Feedback"
          description="Share ideas for Sunday School and help prioritize what would be most useful."
          actions={
            response?.viewer.canSubmit ? (
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4" />
                Submit an idea
              </Button>
            ) : undefined
          }
        />

        {error ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState message="Feedback could not be loaded. Please try again." />
            </CardContent>
          </Card>
        ) : !response?.ideas.length ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState message="No ideas yet. Submit the first one!" />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {response.ideas.map(idea => (
              <Card key={idea.id}>
                <CardContent className="flex flex-col gap-5 pt-6 sm:flex-row">
                  <div className="flex shrink-0 flex-row items-center gap-2 sm:w-24 sm:flex-col">
                    <Button
                      type="button"
                      size="icon"
                      variant={idea.viewerVote === SundaySchoolFeedbackVoteType.UP ? 'default' : 'outline'}
                      aria-label={`Upvote ${idea.title}`}
                      aria-pressed={idea.viewerVote === SundaySchoolFeedbackVoteType.UP}
                      disabled={!idea.canVote || votingIdeaId === idea.id}
                      onClick={() => handleVote(idea, SundaySchoolFeedbackVoteType.UP)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <div className="min-w-12 text-center">
                      <p className="text-xl font-bold" aria-label={`Net score ${idea.score}`}>
                        {idea.score}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">score</p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant={idea.viewerVote === SundaySchoolFeedbackVoteType.DOWN ? 'default' : 'outline'}
                      aria-label={`Downvote ${idea.title}`}
                      aria-pressed={idea.viewerVote === SundaySchoolFeedbackVoteType.DOWN}
                      disabled={!idea.canVote || votingIdeaId === idea.id}
                      onClick={() => handleVote(idea, SundaySchoolFeedbackVoteType.DOWN)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="break-words text-lg font-semibold">{idea.title}</h2>
                          <Badge variant="outline" className={STATUS_STYLES[idea.status]}>
                            {STATUS_LABELS[idea.status]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Submitted by {idea.submitter?.name ?? 'Former user'} on{' '}
                          {formatSubmittedDate(idea.createdAt)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {response.viewer.canModerate && (
                          <select
                            aria-label={`Change status for ${idea.title}`}
                            value={idea.status}
                            disabled={statusSavingIdeaId === idea.id}
                            onChange={event =>
                              handleStatusChange(
                                idea,
                                event.target.value as SundaySchoolFeedbackStatus
                              )
                            }
                            className="h-8 rounded-md border bg-white px-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                          >
                            {Object.values(SundaySchoolFeedbackStatus).map(feedbackStatus => (
                              <option key={feedbackStatus} value={feedbackStatus}>
                                {STATUS_LABELS[feedbackStatus]}
                              </option>
                            ))}
                          </select>
                        )}
                        {idea.canEdit && (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            aria-label={`Edit ${idea.title}`}
                            onClick={() => openEditDialog(idea)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {idea.canDelete && (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            aria-label={`Delete ${idea.title}`}
                            onClick={() => setDeleteIdea(idea)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {idea.description && (
                      <p className="whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300">
                        {idea.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span>{idea.upvotes} upvotes</span>
                      <span>{idea.downvotes} downvotes</span>
                      {!idea.canVote && idea.submitter && idea.canEdit && <span>Your idea</span>}
                      {!idea.canVote &&
                        (idea.status === SundaySchoolFeedbackStatus.COMPLETED ||
                          idea.status === SundaySchoolFeedbackStatus.DECLINED) && (
                          <span>Voting closed</span>
                        )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSave} className="space-y-5">
            <DialogHeader>
              <DialogTitle>{editingIdea ? 'Edit idea' : 'Submit an idea'}</DialogTitle>
              <DialogDescription>
                Describe a change that would make the Sunday School application more useful.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="feedback-title">Title</Label>
              <Input
                id="feedback-title"
                value={title}
                onChange={event => setTitle(event.target.value)}
                maxLength={FEEDBACK_TITLE_MAX_LENGTH}
                placeholder="What would you like to add or improve?"
                required
                autoFocus
              />
              <p className="text-right text-xs text-gray-500">
                {title.length}/{FEEDBACK_TITLE_MAX_LENGTH}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-description">Details (optional)</Label>
              <Textarea
                id="feedback-description"
                value={description}
                onChange={event => setDescription(event.target.value)}
                maxLength={FEEDBACK_DESCRIPTION_MAX_LENGTH}
                rows={6}
                placeholder="Explain the need, who it would help, or how it could work."
              />
              <p className="text-right text-xs text-gray-500">
                {description.length}/{FEEDBACK_DESCRIPTION_MAX_LENGTH}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || title.trim().length < 3}>
                {saving ? 'Saving…' : editingIdea ? 'Save changes' : 'Submit idea'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteIdea)} onOpenChange={open => !open && setDeleteIdea(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this idea?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteIdea?.title}” and all of its votes will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? 'Deleting…' : 'Delete idea'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
