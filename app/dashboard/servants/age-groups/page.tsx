'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useSundaySchoolAgeGroups } from '@/lib/swr'
import { getLevelDisplayName, LEVEL_ORDER } from '@/lib/sunday-school-class'
import type { SundaySchoolAgeGroup } from '@/types/sunday-school'
import { SundaySchoolLevel } from '@prisma/client'
import { Pencil, Plus, Trash2 } from 'lucide-react'

/**
 * Age groups (Elementary / Middle / High) are data, not an enum, so the church
 * can redraw them without a migration. A class's band is whichever group lists
 * its grade — so moving a grade here re-parents its classes and hands them to
 * a different coordinator.
 */
export default function SundaySchoolAgeGroupsPage() {
  const { status } = useSundaySchoolGuard()
  const { data, isLoading, mutate } = useSundaySchoolAgeGroups()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [levels, setLevels] = useState<SundaySchoolLevel[]>([])
  const [saving, setSaving] = useState(false)

  const ageGroups = (data as SundaySchoolAgeGroup[] | undefined) ?? []

  // Levels another band already owns cannot be picked here
  const claimedElsewhere = new Set(
    ageGroups.filter(g => g.id !== editingId).flatMap(g => g.levels)
  )

  const openCreate = () => {
    setEditingId(null)
    setName('')
    setLevels([])
    setDialogOpen(true)
  }

  const openEdit = (group: SundaySchoolAgeGroup) => {
    setEditingId(group.id)
    setName(group.name)
    setLevels(group.levels)
    setDialogOpen(true)
  }

  const toggleLevel = (level: SundaySchoolLevel) => {
    setLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const url = editingId
        ? `/api/sunday-school/age-groups/${editingId}`
        : '/api/sunday-school/age-groups'
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, levels }),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || 'Failed to save the age group')
      }

      toast.success(editingId ? 'Age group updated' : 'Age group created', {
        description: new Date().toLocaleString(),
      })
      setDialogOpen(false)
      mutate()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save the age group')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (group: SundaySchoolAgeGroup) => {
    if (
      !confirm(
        `Delete ${group.name}? Its coordinator assignments are removed. The classes themselves are kept, but become unbanded until another group claims their grades.`
      )
    ) {
      return
    }

    try {
      const res = await fetch(`/api/sunday-school/age-groups/${group.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Failed to delete the age group')
      }
      toast.success('Age group deleted')
      mutate()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete the age group')
    }
  }

  if (status === 'loading' || isLoading) {
    return <PageLoading />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Age Groups"
          description="Elementary, Middle, High — and which grades belong to each. A coordinator of a band runs every class in it."
          actions={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              New age group
            </Button>
          }
        />

        <Card>
          <CardContent className="pt-6">
            {ageGroups.length === 0 ? (
              <EmptyState message="No age groups yet. Create one to group classes into bands." />
            ) : (
              <div className="divide-y dark:divide-gray-800">
                {ageGroups.map(group => {
                  const coordinators = (group.assignments ?? []).filter(a => a.ageGroupId === group.id)
                  return (
                    <div
                      key={group.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{group.name}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {group.levels.map(level => (
                            <Badge key={level} variant="secondary">
                              {getLevelDisplayName(level)}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                          {coordinators.length > 0
                            ? `Coordinators: ${coordinators.map(a => a.user.name).join(', ')}`
                            : 'No coordinator assigned'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(group)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(group)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit age group' : 'New age group'}</DialogTitle>
            <DialogDescription>
              Pick the grades this band covers. A grade can belong to only one band.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ag-name">Name</Label>
              <Input
                id="ag-name"
                value={name}
                placeholder="e.g. High School"
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Grades</Label>
              <div className="grid grid-cols-2 gap-2">
                {LEVEL_ORDER.map(level => {
                  const taken = claimedElsewhere.has(level)
                  return (
                    <label
                      key={level}
                      className={`flex items-center gap-2 text-sm ${taken ? 'text-gray-400' : ''}`}
                    >
                      <input
                        type="checkbox"
                        disabled={taken}
                        checked={levels.includes(level)}
                        onChange={() => toggleLevel(level)}
                      />
                      {getLevelDisplayName(level)}
                      {taken && <span className="text-xs">(taken)</span>}
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim() || levels.length === 0}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
