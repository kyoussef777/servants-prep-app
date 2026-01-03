'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { isAdmin } from '@/lib/roles'
import { toast } from 'sonner'
import { Calendar, Plus, Pencil, Trash2, Check, BookOpen, GraduationCap } from 'lucide-react'

interface AcademicYear {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
  _count?: {
    lessons: number
    exams: number
  }
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null)

  // Form states
  const [formName, setFormName] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formIsActive, setFormIsActive] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role && !isAdmin(session.user.role)) {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    fetchAcademicYears()
  }, [])

  const fetchAcademicYears = async () => {
    try {
      const res = await fetch('/api/academic-years')
      if (res.ok) {
        const data = await res.json()
        setAcademicYears(data)
      }
    } catch (error) {
      toast.error('Failed to load academic years')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormName('')
    setFormStartDate('')
    setFormEndDate('')
    setFormIsActive(false)
  }

  const openCreateDialog = () => {
    resetForm()
    // Suggest next year name based on existing years
    const currentYear = new Date().getFullYear()
    const suggestedName = `${currentYear}-${currentYear + 1}`
    setFormName(suggestedName)
    setFormStartDate(`${currentYear}-09-01`)
    setFormEndDate(`${currentYear + 1}-06-30`)
    setShowCreateDialog(true)
  }

  const openEditDialog = (year: AcademicYear) => {
    setSelectedYear(year)
    setFormName(year.name)
    setFormStartDate(year.startDate.split('T')[0])
    setFormEndDate(year.endDate.split('T')[0])
    setFormIsActive(year.isActive)
    setShowEditDialog(true)
  }

  const openDeleteDialog = (year: AcademicYear) => {
    setSelectedYear(year)
    setShowDeleteDialog(true)
  }

  const handleCreate = async () => {
    if (!formName || !formStartDate || !formEndDate) {
      toast.error('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/academic-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          startDate: formStartDate,
          endDate: formEndDate,
          isActive: formIsActive,
        }),
      })

      if (res.ok) {
        toast.success('Academic year created successfully')
        setShowCreateDialog(false)
        fetchAcademicYears()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create academic year')
      }
    } catch (error) {
      toast.error('Failed to create academic year')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedYear || !formName || !formStartDate || !formEndDate) {
      toast.error('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/academic-years/${selectedYear.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          startDate: formStartDate,
          endDate: formEndDate,
          isActive: formIsActive,
        }),
      })

      if (res.ok) {
        toast.success('Academic year updated successfully')
        setShowEditDialog(false)
        fetchAcademicYears()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update academic year')
      }
    } catch (error) {
      toast.error('Failed to update academic year')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedYear) return

    setSaving(true)
    try {
      const res = await fetch(`/api/academic-years/${selectedYear.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Academic year deleted successfully')
        setShowDeleteDialog(false)
        fetchAcademicYears()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete academic year')
      }
    } catch (error) {
      toast.error('Failed to delete academic year')
    } finally {
      setSaving(false)
    }
  }

  const handleSetActive = async (year: AcademicYear) => {
    if (year.isActive) return

    setSaving(true)
    try {
      const res = await fetch(`/api/academic-years/${year.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })

      if (res.ok) {
        toast.success(`${year.name} is now the active academic year`)
        fetchAcademicYears()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to set active year')
      }
    } catch (error) {
      toast.error('Failed to set active year')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600 mt-1">Manage system configuration</p>
        </div>

        {/* Academic Years Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-maroon-600" />
                <div>
                  <CardTitle>Academic Years</CardTitle>
                  <CardDescription>
                    Manage academic years for lessons and exams
                  </CardDescription>
                </div>
              </div>
              <Button onClick={openCreateDialog} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Year
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {academicYears.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No academic years configured</p>
                <p className="text-sm mt-1">Create your first academic year to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {academicYears.map((year) => (
                  <div
                    key={year.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      year.isActive ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">{year.name}</span>
                          {year.isActive && (
                            <Badge className="bg-green-100 text-green-800 border-green-300">
                              <Check className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {formatDate(year.startDate)} - {formatDate(year.endDate)}
                        </p>
                        {year._count && (
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <BookOpen className="h-3 w-3" />
                              {year._count.lessons} lessons
                            </span>
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-3 w-3" />
                              {year._count.exams} exams
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!year.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetActive(year)}
                          disabled={saving}
                        >
                          Set Active
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(year)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(year)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Academic Year</DialogTitle>
              <DialogDescription>
                Add a new academic year for organizing lessons and exams
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., 2025-2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isActive" className="text-sm font-normal">
                  Set as active year (dashboards will show this year by default)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Academic Year</DialogTitle>
              <DialogDescription>
                Update the academic year details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., 2025-2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-startDate">Start Date</Label>
                  <Input
                    id="edit-startDate"
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-endDate">End Date</Label>
                  <Input
                    id="edit-endDate"
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-isActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-isActive" className="text-sm font-normal">
                  Set as active year
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Academic Year</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{selectedYear?.name}</strong>?
                {selectedYear?._count && (selectedYear._count.lessons > 0 || selectedYear._count.exams > 0) && (
                  <span className="block mt-2 text-red-600">
                    Warning: This year has {selectedYear._count.lessons} lessons and {selectedYear._count.exams} exams associated with it. Deleting may cause data loss.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
                disabled={saving}
              >
                {saving ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
