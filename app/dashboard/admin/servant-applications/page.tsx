'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { canReviewServantApplications } from '@/lib/roles'
import { useServantApplications } from '@/lib/swr'
import { CheckCircle, Clock, Eye, Loader2, XCircle } from 'lucide-react'
import { RegistrationStatus } from '@prisma/client'

interface ServantApplication {
  id: string
  status: RegistrationStatus
  email: string
  fullName: string
  phone: string
  availability: string | null
  motivation: string | null
  createdAt: string
  reviewer: { name: string; email: string } | null
  reviewNote: string | null
  reviewedAt: string | null
}

function statusBadge(status: RegistrationStatus) {
  switch (status) {
    case 'PENDING':
      return (
        <Badge variant="outline" className="border-yellow-500 text-yellow-700">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      )
    case 'APPROVED':
      return (
        <Badge variant="outline" className="border-green-500 text-green-700">
          <CheckCircle className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      )
    case 'REJECTED':
      return (
        <Badge variant="outline" className="border-red-500 text-red-700">
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      )
  }
}

export default function ServantApplicationsPage() {
  const { data: session } = useSession()

  if (!session?.user || !canReviewServantApplications(session.user.role)) {
    redirect('/dashboard')
  }

  const { data: applications, mutate } = useServantApplications()
  const [selected, setSelected] = useState<ServantApplication | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Servant Applications</h1>
          <p className="text-gray-600 mt-1">Review Sunday School servant sign-up applications</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
            <CardDescription>Approving creates a Sunday School Servant account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!applications || applications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        No applications yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    applications.map((application: ServantApplication) => (
                      <TableRow key={application.id}>
                        <TableCell className="font-medium">{application.fullName}</TableCell>
                        <TableCell>{application.email}</TableCell>
                        <TableCell>{new Date(application.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{statusBadge(application.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelected(application)
                              setIsDialogOpen(true)
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {selected && (
        <ApplicationDetailDialog
          application={selected}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onUpdate={() => mutate()}
        />
      )}
    </div>
  )
}

function ApplicationDetailDialog({
  application,
  open,
  onOpenChange,
  onUpdate,
}: {
  application: ServantApplication
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
}) {
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [note, setNote] = useState('')

  const canReview = application.status === 'PENDING'

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      const res = await fetch(`/api/servant-applications/${application.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', note }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to approve')
      }

      const data = await res.json()
      toast.success('Application approved!', {
        description: `Temp password: ${data.tempPassword}`,
        duration: 10000,
      })
      onUpdate()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve application')
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    if (!note.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    setIsRejecting(true)
    try {
      const res = await fetch(`/api/servant-applications/${application.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', note }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reject')
      }

      toast.success('Application rejected')
      onUpdate()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject application')
    } finally {
      setIsRejecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Servant Application</DialogTitle>
          <DialogDescription>
            {application.fullName} &middot; Submitted {new Date(application.createdAt).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-600">Email:</span> {application.email}</div>
            <div><span className="text-gray-600">Phone:</span> {application.phone}</div>
            {application.availability && (
              <div className="col-span-2"><span className="text-gray-600">Availability:</span> {application.availability}</div>
            )}
          </div>
          {application.motivation && (
            <div>
              <p className="text-sm text-gray-600 mb-1">Why they want to serve:</p>
              <p className="text-sm">{application.motivation}</p>
            </div>
          )}

          {canReview && (
            <div className="border-t pt-4 space-y-2">
              <label className="text-sm text-gray-700" htmlFor="reviewNote">
                Review Note (optional for approval, required for rejection)
              </label>
              <Textarea id="reviewNote" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          )}

          {!canReview && (
            <div className="border-t pt-4 text-sm space-y-1">
              <div><span className="text-gray-600">Reviewed By:</span> {application.reviewer?.name}</div>
              <div><span className="text-gray-600">Reviewed At:</span> {application.reviewedAt && new Date(application.reviewedAt).toLocaleString()}</div>
              {application.reviewNote && (
                <div><span className="text-gray-600">Note:</span> {application.reviewNote}</div>
              )}
            </div>
          )}
        </div>

        {canReview && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isApproving || isRejecting}>
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
