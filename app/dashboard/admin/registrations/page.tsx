'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { canViewRegistrations, canManageInviteCodes, canReviewRegistrations } from '@/lib/roles'
import { useInviteCodes, useRegistrationSubmissions, useRegistrationSettings } from '@/lib/swr'
import { Copy, Plus, Eye, CheckCircle, XCircle, Clock, AlertCircle, Loader2, Power, PowerOff, Trash2, Ban, RefreshCw } from 'lucide-react'
import { RegistrationStatus, StudentGrade, YearLevel } from '@prisma/client'
import { getGradeDisplayName } from '@/lib/registration-utils'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'

export default function RegistrationsPage() {
  const { data: session } = useSession()

  if (!session?.user || !canViewRegistrations(session.user.role)) {
    redirect('/dashboard')
  }

  const [activeTab, setActiveTab] = useState('submissions')

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Registration Management</h1>
          <p className="text-gray-600 mt-1">Manage student registration applications and invite codes</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          {canManageInviteCodes(session.user.role) && (
            <TabsTrigger value="invite-codes">Invite Codes</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="submissions" className="mt-6">
          <SubmissionsTab />
        </TabsContent>

        {canManageInviteCodes(session.user.role) && (
          <TabsContent value="invite-codes" className="mt-6">
            <InviteCodesTab />
          </TabsContent>
        )}
      </Tabs>
      </div>
    </div>
  )
}

function SubmissionsTab() {
  const { data: session } = useSession()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null)
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)

  const { data: submissionsData, mutate } = useRegistrationSubmissions(
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  )

  const submissions = submissionsData?.submissions || []
  const pagination = submissionsData?.pagination

  const handleDeleteSubmission = async (submissionId: string) => {
    try {
      const res = await fetch(`/api/registration/submissions/${submissionId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete submission')
      }

      toast.success('Submission deleted')
      mutate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete submission')
    }
  }

  const getStatusBadge = (status: RegistrationStatus) => {
    switch (status) {
      case RegistrationStatus.PENDING:
        return <Badge variant="outline" className="border-yellow-500 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      case RegistrationStatus.APPROVED:
        return <Badge variant="outline" className="border-green-500 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>
      case RegistrationStatus.REJECTED:
        return <Badge variant="outline" className="border-red-500 text-red-700"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>
    }
  }

  const pendingCount = submissions.filter((s: any) => s.status === RegistrationStatus.PENDING).length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Registration Submissions</CardTitle>
              <CardDescription>Review and manage student applications</CardDescription>
            </div>
            {pendingCount > 0 && (
              <Badge className="bg-yellow-500">{pendingCount} Pending</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label className="text-sm text-gray-600 mb-2 block">Filter by status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Submissions</SelectItem>
                <SelectItem value={RegistrationStatus.PENDING}>Pending</SelectItem>
                <SelectItem value={RegistrationStatus.APPROVED}>Approved</SelectItem>
                <SelectItem value={RegistrationStatus.REJECTED}>Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500">
                      No submissions found
                    </TableCell>
                  </TableRow>
                ) : (
                  submissions.map((submission: any) => (
                    <TableRow key={submission.id}>
                      <TableCell className="font-medium">{submission.fullName}</TableCell>
                      <TableCell>{submission.email}</TableCell>
                      <TableCell>{getGradeDisplayName(submission.grade)}</TableCell>
                      <TableCell>{new Date(submission.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{getStatusBadge(submission.status)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSubmission(submission)
                              setIsReviewDialogOpen(true)
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          {session?.user && canReviewRegistrations(session.user.role) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" title="Delete submission">
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Submission?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the submission from <strong>{submission.fullName}</strong>? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteSubmission(submission.id)} className="bg-red-600 hover:bg-red-700">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {submissions.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No submissions found</div>
            ) : (
              submissions.map((submission: any) => (
                <Card key={submission.id} className="border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold">{submission.fullName}</div>
                        <div className="text-sm text-gray-600">{submission.email}</div>
                      </div>
                      {getStatusBadge(submission.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Grade:</span> {getGradeDisplayName(submission.grade)}
                      </div>
                      <div>
                        <span className="text-gray-600">Submitted:</span> {new Date(submission.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedSubmission(submission)
                          setIsReviewDialogOpen(true)
                        }}
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      {session?.user && canReviewRegistrations(session.user.role) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Submission?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the submission from <strong>{submission.fullName}</strong>? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteSubmission(submission.id)} className="bg-red-600 hover:bg-red-700">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 text-center text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedSubmission && (
        <SubmissionDetailDialog
          submission={selectedSubmission}
          open={isReviewDialogOpen}
          onOpenChange={setIsReviewDialogOpen}
          onUpdate={() => mutate()}
        />
      )}
    </div>
  )
}

function SubmissionDetailDialog({
  submission,
  open,
  onOpenChange,
  onUpdate,
}: {
  submission: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
}) {
  const { data: session } = useSession()
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [reviewNote, setReviewNote] = useState('')
  const [yearLevel, setYearLevel] = useState<YearLevel>(YearLevel.YEAR_1)

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      const res = await fetch(`/api/registration/submissions/${submission.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          note: reviewNote,
          yearLevel,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to approve')
      }

      const data = await res.json()
      toast.success('Registration approved!', {
        description: `Temp password: ${data.tempPassword}`,
        duration: 10000,
      })
      onUpdate()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve registration')
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    if (!reviewNote.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    setIsRejecting(true)
    try {
      const res = await fetch(`/api/registration/submissions/${submission.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          note: reviewNote,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reject')
      }

      toast.success('Registration rejected')
      onUpdate()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject registration')
    } finally {
      setIsRejecting(false)
    }
  }

  const canReview = session?.user && canReviewRegistrations(session.user.role) && submission.status === RegistrationStatus.PENDING

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registration Detail</DialogTitle>
          <DialogDescription>
            {submission.fullName} - Submitted {new Date(submission.createdAt).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Personal Info */}
          <div>
            <h4 className="font-semibold mb-2">Personal Information</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-600">Email:</span> {submission.email}</div>
              <div><span className="text-gray-600">Phone:</span> {submission.phone}</div>
              <div><span className="text-gray-600">Date of Birth:</span> {new Date(submission.dateOfBirth).toLocaleDateString()}</div>
              <div><span className="text-gray-600">Grade:</span> {getGradeDisplayName(submission.grade)}</div>
            </div>
          </div>

          {/* Church Info */}
          <div>
            <h4 className="font-semibold mb-2">Church Information</h4>
            <div className="text-sm">
              <span className="text-gray-600">Father of Confession:</span> {submission.fatherOfConfessionName}
            </div>
          </div>

          {/* Service History */}
          <div>
            <h4 className="font-semibold mb-2">Service History</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-600">Previously Served:</span> {submission.previouslyServed ? 'Yes' : 'No'}</div>
              <div><span className="text-gray-600">Currently Serving:</span> {submission.currentlyServing ? 'Yes' : 'No'}</div>
              <div className="col-span-2"><span className="text-gray-600">Previously Attended Prep:</span> {submission.previouslyAttendedPrep ? `Yes (${submission.previousPrepLocation})` : 'No'}</div>
            </div>
          </div>

          {/* Mentor Info */}
          <div>
            <h4 className="font-semibold mb-2">Mentor Servant Information</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-600">Name:</span> {submission.mentorName}</div>
              <div><span className="text-gray-600">Phone:</span> {submission.mentorPhone}</div>
              <div className="col-span-2"><span className="text-gray-600">Email:</span> {submission.mentorEmail}</div>
            </div>
          </div>

          {/* Approval Form */}
          <div>
            <h4 className="font-semibold mb-2">Approval Form</h4>
            <a
              href={submission.approvalFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-maroon-600 hover:underline flex items-center"
            >
              <Eye className="w-4 h-4 mr-1" />
              View {submission.approvalFormFilename}
            </a>
          </div>

          {/* Review Section (if pending) */}
          {canReview && (
            <div className="border-t pt-4 space-y-4">
              <div>
                <Label htmlFor="yearLevel">Starting Year Level</Label>
                <Select value={yearLevel} onValueChange={(value) => setYearLevel(value as YearLevel)}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={YearLevel.YEAR_1}>Year 1</SelectItem>
                    <SelectItem value={YearLevel.YEAR_2}>Year 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="reviewNote">Review Note (optional for approval, required for rejection)</Label>
                <Textarea
                  id="reviewNote"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Add any notes about this review..."
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Existing Review Info */}
          {submission.status !== RegistrationStatus.PENDING && (
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Review Information</h4>
              <div className="text-sm space-y-1">
                <div><span className="text-gray-600">Status:</span> {submission.status}</div>
                <div><span className="text-gray-600">Reviewed By:</span> {submission.reviewer?.name}</div>
                <div><span className="text-gray-600">Reviewed At:</span> {new Date(submission.reviewedAt).toLocaleString()}</div>
                {submission.reviewNote && (
                  <div><span className="text-gray-600">Note:</span> {submission.reviewNote}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {canReview && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isApproving || isRejecting}
            >
              {isRejecting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
              Reject
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isApproving || isRejecting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isApproving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
              Approve
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function InviteCodesTab() {
  const { data: inviteCodes, mutate } = useInviteCodes()
  const { data: settings, mutate: mutateSettings } = useRegistrationSettings()
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false)
  const [isTogglingRegistration, setIsTogglingRegistration] = useState(false)

  const registrationEnabled = settings?.registrationEnabled ?? true

  const handleToggleRegistration = async () => {
    setIsTogglingRegistration(true)
    try {
      const res = await fetch('/api/registration/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationEnabled: !registrationEnabled }),
      })

      if (!res.ok) {
        throw new Error('Failed to update settings')
      }

      toast.success(`Registration ${!registrationEnabled ? 'enabled' : 'disabled'}`)
      mutateSettings()
    } catch (error) {
      toast.error('Failed to update registration settings')
    } finally {
      setIsTogglingRegistration(false)
    }
  }

  const handleToggleCodeActive = async (codeId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/registration/invite-codes/${codeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      })

      if (!res.ok) {
        throw new Error('Failed to update code')
      }

      toast.success(`Code ${!currentActive ? 'activated' : 'deactivated'}`)
      mutate()
    } catch (error) {
      toast.error('Failed to update code')
    }
  }

  const handleDeleteCode = async (codeId: string) => {
    try {
      const res = await fetch(`/api/registration/invite-codes/${codeId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete code')
      }

      toast.success('Code deleted')
      mutate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete code')
    }
  }

  const getCodeStatusBadge = (code: any) => {
    const now = new Date()
    if (!code.isActive) {
      return <Badge variant="outline" className="border-gray-500 text-gray-700">Revoked</Badge>
    }
    if (code.expiresAt && new Date(code.expiresAt) < now) {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-700">Expired</Badge>
    }
    if (code.maxUses > 0 && code.usageCount >= code.maxUses) {
      return <Badge variant="outline" className="border-gray-500 text-gray-700">Exhausted</Badge>
    }
    return <Badge variant="outline" className="border-green-500 text-green-700">Active</Badge>
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success('Code copied to clipboard!')
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Invite Codes</CardTitle>
              <CardDescription>Generate and manage registration invite codes</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant={registrationEnabled ? "destructive" : "default"}
                size="sm"
                onClick={handleToggleRegistration}
                disabled={isTogglingRegistration}
                className="w-full sm:w-auto"
              >
                {registrationEnabled ? <PowerOff className="w-4 h-4 mr-1" /> : <Power className="w-4 h-4 mr-1" />}
                <span className="hidden sm:inline">{registrationEnabled ? 'Close Registration' : 'Open Registration'}</span>
                <span className="sm:hidden">{registrationEnabled ? 'Close' : 'Open'}</span>
              </Button>
              <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="w-full sm:w-auto">
                    <Plus className="w-4 h-4 mr-1" />
                    Generate Code
                  </Button>
                </DialogTrigger>
                <GenerateCodeDialog onSuccess={() => {
                  mutate()
                  setIsGenerateDialogOpen(false)
                }} />
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!inviteCodes || inviteCodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500">
                      No invite codes yet
                    </TableCell>
                  </TableRow>
                ) : (
                  inviteCodes.map((code: any) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono font-semibold">{code.code}</TableCell>
                      <TableCell>{code.label || '-'}</TableCell>
                      <TableCell>
                        {code.usageCount} / {code.maxUses === 0 ? '∞' : code.maxUses}
                      </TableCell>
                      <TableCell>
                        {code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell>{getCodeStatusBadge(code)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyCode(code.code)}
                            title="Copy code"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleCodeActive(code.id, code.isActive)}
                            title={code.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {code.isActive ? <Ban className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                          </Button>
                          {code._count.registrations === 0 && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" title="Delete code">
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Invite Code?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete code <strong>{code.code}</strong>? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteCode(code.id)} className="bg-red-600 hover:bg-red-700">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {!inviteCodes || inviteCodes.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No invite codes yet</div>
            ) : (
              inviteCodes.map((code: any) => (
                <Card key={code.id} className="border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-mono font-bold text-lg">{code.code}</div>
                        {code.label && <div className="text-sm text-gray-600">{code.label}</div>}
                      </div>
                      {getCodeStatusBadge(code)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Uses:</span>{' '}
                        {code.usageCount} / {code.maxUses === 0 ? '∞' : code.maxUses}
                      </div>
                      <div>
                        <span className="text-gray-600">Expires:</span>{' '}
                        {code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : 'Never'}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyCode(code.code)}
                        className="flex-1"
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleCodeActive(code.id, code.isActive)}
                        className="flex-1"
                      >
                        {code.isActive ? (
                          <>
                            <Ban className="w-4 h-4 mr-1" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Activate
                          </>
                        )}
                      </Button>
                      {code._count.registrations === 0 && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Invite Code?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete code <strong>{code.code}</strong>? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCode(code.id)} className="bg-red-600 hover:bg-red-700">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function GenerateCodeDialog({ onSuccess }: { onSuccess: () => void }) {
  const [label, setLabel] = useState('')
  const [maxUses, setMaxUses] = useState('10')
  const [expiresAt, setExpiresAt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch('/api/registration/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label || null,
          maxUses: parseInt(maxUses) || 0,
          expiresAt: expiresAt || null,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to generate code')
      }

      const data = await res.json()
      toast.success('Invite code generated!', {
        description: `Code: ${data.code}`,
      })
      onSuccess()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate code')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Generate Invite Code</DialogTitle>
        <DialogDescription>Create a new registration invite code</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label htmlFor="label">Label (optional)</Label>
          <Input
            id="label"
            placeholder="e.g., Fall 2026 Registration"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="maxUses">Maximum Uses (0 = unlimited)</Label>
          <Input
            id="maxUses"
            type="number"
            min="0"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="expiresAt">Expiration Date (optional)</Label>
          <Input
            id="expiresAt"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-1" />
              Generate
            </>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
