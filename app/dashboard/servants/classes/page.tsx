'use client'

import { useState } from 'react'
import Link from 'next/link'
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
import { useAdminGuard } from '@/hooks/useAdminGuard'
import { canAccessSundaySchool, canManageSundaySchoolClasses } from '@/lib/roles'
import { useSundaySchoolClasses } from '@/lib/swr'
import { getLevelDisplayName, LEVEL_ORDER } from '@/lib/sunday-school-class'
import type { SundaySchoolClass } from '@/types/sunday-school'
import { SundaySchoolLevel, UserRole } from '@prisma/client'
import { Plus, Users } from 'lucide-react'

export default function SundaySchoolClassesPage() {
  const { session, status } = useAdminGuard(canAccessSundaySchool)
  const { data, isLoading, mutate } = useSundaySchoolClasses()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{ name: string; level: SundaySchoolLevel }>({
    name: '',
    level: 'GRADE_1',
  })

  const role = session?.user?.role as UserRole | undefined
  const canManage = role ? canManageSundaySchoolClasses(role) : false

  const handleCreate = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/sunday-school/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || 'Failed to create the class')
      }

      toast.success('Class created', { description: new Date().toLocaleString() })
      setDialogOpen(false)
      setForm({ name: '', level: 'GRADE_1' })
      mutate()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create the class')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return <PageLoading />
  }

  const classes = (data as SundaySchoolClass[] | undefined) ?? []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader
          title="Sunday School Classes"
          description="Classes, their servants, and their rosters."
          actions={
            canManage ? (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                New class
              </Button>
            ) : undefined
          }
        />

        <Card>
          <CardContent className="pt-6">
            {classes.length === 0 ? (
              <EmptyState
                message={
                  canManage
                    ? 'No classes yet. Create the first one to get started.'
                    : 'You are not assigned to any Sunday School class yet.'
                }
              />
            ) : (
              <div className="space-y-3">
                {classes.map(cls => (
                  <div
                    key={cls.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg dark:border-gray-800"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/dashboard/servants/classes/${cls.id}`}
                          className="font-medium hover:underline"
                        >
                          {cls.name}
                        </Link>
                        <Badge variant="secondary">{getLevelDisplayName(cls.level)}</Badge>
                        {!cls.isActive && <Badge className="bg-gray-500">Inactive</Badge>}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {cls._count?.children ?? 0} children · {cls._count?.sessions ?? 0} sessions ·{' '}
                        {cls.servants.length} {cls.servants.length === 1 ? 'servant' : 'servants'}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/servants/classes/${cls.id}`}>
                        <Users className="h-4 w-4 mr-1" />
                        Open
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Sunday School class</DialogTitle>
            <DialogDescription>
              Give the class a name and pick the grade level it serves.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Class name</Label>
              <Input
                id="name"
                value={form.name}
                placeholder="e.g. Grade 3 Boys"
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">Grade level</Label>
              <select
                id="level"
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !form.name.trim()}>
              {saving ? 'Creating…' : 'Create class'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
