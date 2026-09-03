'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PageLoading } from '@/components/ui/page-loading'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/admin/page-header'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSundaySchoolGuard } from '@/hooks/useSundaySchoolGuard'
import { useSundaySchoolChildren, useSundaySchoolClasses } from '@/lib/swr'
import { getChildFullName, getLevelDisplayName, LEVEL_ORDER } from '@/lib/sunday-school-class'
import type { SundaySchoolChild, SundaySchoolClass } from '@/types/sunday-school'
import { SundaySchoolLevel } from '@prisma/client'
import { Pencil, Plus, Trash2 } from 'lucide-react'

interface ChildForm {
  firstName: string
  lastName: string
  level: SundaySchoolLevel
  classId: string
  guardianName: string
  guardianPhone: string
  guardianEmail: string
  notes: string
}

const EMPTY_FORM: ChildForm = {
  firstName: '',
  lastName: '',
  level: 'GRADE_1',
  classId: '',
  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
  notes: '',
}

function SundaySchoolChildrenContent() {
  const { status } = useSundaySchoolGuard()
  const searchParams = useSearchParams()

  const { data: classesData } = useSundaySchoolClasses()
  const classes = useMemo(() => (classesData as SundaySchoolClass[] | undefined) ?? [], [classesData])

  const [selectedClassId, setSelectedClassId] = useState('')
  const { data, isLoading, mutate } = useSundaySchoolChildren(selectedClassId || undefined)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ChildForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Editing a roster follows from serving that class, which the server decides
  const selectedClass = classes.find(c => c.id === selectedClassId)
  const canManage = selectedClass?.canServe ?? false

  useEffect(() => {
    if (selectedClassId || classes.length === 0) return
    const fromQuery = searchParams.get('classId')
    const match = fromQuery && classes.some(c => c.id === fromQuery) ? fromQuery : classes[0].id
    setSelectedClassId(match)
  }, [classes, searchParams, selectedClassId])

  const openCreate = () => {
    setEditingId(null)
    const cls = classes.find(c => c.id === selectedClassId)
    setForm({ ...EMPTY_FORM, classId: selectedClassId, level: cls?.level ?? 'GRADE_1' })
    setDialogOpen(true)
  }

  const openEdit = (child: SundaySchoolChild) => {
    setEditingId(child.id)
    setForm({
      firstName: child.firstName,
      lastName: child.lastName,
      level: child.level,
      classId: child.classId ?? '',
      guardianName: child.guardianName ?? '',
      guardianPhone: child.guardianPhone ?? '',
      guardianEmail: child.guardianEmail ?? '',
      notes: child.notes ?? '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const url = editingId
        ? `/api/sunday-school/children/${editingId}`
        : '/api/sunday-school/children'
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, classId: form.classId || null }),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || 'Failed to save the child')
      }

      toast.success(editingId ? 'Child updated' : 'Child added', {
        description: new Date().toLocaleString(),
      })
      setDialogOpen(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      mutate()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save the child')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (child: SundaySchoolChild) => {
    if (!confirm(`Remove ${getChildFullName(child)} from the roster? This also deletes their attendance history.`)) {
      return
    }

    try {
      const res = await fetch(`/api/sunday-school/children/${child.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Failed to remove the child')
      }
      toast.success('Child removed')
      mutate()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove the child')
    }
  }

  if (status === 'loading') {
    return <PageLoading />
  }

  const children = (data as SundaySchoolChild[] | undefined) ?? []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Children"
          description="Roster and guardian contact for the children in your class."
          actions={
            canManage && classes.length > 0 ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" />
                Add child
              </Button>
            ) : undefined
          }
        />

        {classes.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState message="You are not assigned to any Sunday School class yet." />
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2 max-w-sm">
                  <Label htmlFor="class-filter">Class</Label>
                  <select
                    id="class-filter"
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value)}
                    className="w-full h-9 rounded-md border px-3 text-sm bg-white dark:bg-gray-900 dark:border-gray-700"
                  >
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} — {getLevelDisplayName(cls.level)}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <p className="text-center py-8 text-gray-500">Loading roster…</p>
                ) : children.length === 0 ? (
                  <EmptyState message="No children on this roster yet." />
                ) : (
                  <div className="divide-y dark:divide-gray-800">
                    {children.map(child => (
                      <div
                        key={child.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-medium ${child.isActive ? '' : 'text-gray-400 line-through'}`}>
                              {getChildFullName(child)}
                            </p>
                            <Badge variant="secondary">{getLevelDisplayName(child.level)}</Badge>
                          </div>
                          {(child.guardianName || child.guardianPhone) && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              Guardian: {child.guardianName ?? '—'}
                              {child.guardianPhone && ` · ${child.guardianPhone}`}
                            </p>
                          )}
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(child)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(child)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit child' : 'Add a child'}</DialogTitle>
            <DialogDescription>
              Guardian contact is only visible to the servants of this class and to leaders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={e => setForm(prev => ({ ...prev, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={e => setForm(prev => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="child-level">Grade</Label>
                <select
                  id="child-level"
                  value={form.level}
                  onChange={e => setForm(prev => ({ ...prev, level: e.target.value as SundaySchoolLevel }))}
                  className="w-full h-9 rounded-md border px-3 text-sm bg-white dark:bg-gray-900 dark:border-gray-700"
                >
                  {LEVEL_ORDER.map(level => (
                    <option key={level} value={level}>
                      {getLevelDisplayName(level)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="child-class">Class</Label>
                <select
                  id="child-class"
                  value={form.classId}
                  onChange={e => setForm(prev => ({ ...prev, classId: e.target.value }))}
                  className="w-full h-9 rounded-md border px-3 text-sm bg-white dark:bg-gray-900 dark:border-gray-700"
                >
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guardianName">Guardian name</Label>
              <Input
                id="guardianName"
                value={form.guardianName}
                onChange={e => setForm(prev => ({ ...prev, guardianName: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="guardianPhone">Guardian phone</Label>
                <Input
                  id="guardianPhone"
                  value={form.guardianPhone}
                  onChange={e => setForm(prev => ({ ...prev, guardianPhone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardianEmail">Guardian email</Label>
                <Input
                  id="guardianEmail"
                  type="email"
                  value={form.guardianEmail}
                  onChange={e => setForm(prev => ({ ...prev, guardianEmail: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.firstName.trim() || !form.lastName.trim()}
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add child'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SundaySchoolChildrenPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <SundaySchoolChildrenContent />
    </Suspense>
  )
}
